import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Order, WalletEntry } from '../../../packages/domain/src/index.ts';
import { createApp, type AppConfig } from '../src/app.ts';
import { Store } from '../src/db.ts';
import { createManagementAccount } from '../src/security.ts';

type Context = Awaited<ReturnType<typeof createApp>>;
const managementPassword = 'Local fixture password for UAT tests only';
const checkout = {
  merchantId: 'merchant-laochen',
  communityId: 'community-yangguang',
  batchId: 'batch-laochen-demo',
  fulfillment: 'pickup',
  recipientName: '测试订单收件人',
  recipientPhone: '13800000000',
};

function mockWechat(t: TestContext): Pick<AppConfig, 'wechatFetch'> {
  const keys = ['WECHAT_APP_ID', 'WECHAT_APP_SECRET', 'WECHAT_APP_SECRET_FILE'] as const;
  const previous = keys.map(key => process.env[key]);
  process.env.WECHAT_APP_ID = 'wx-uat-http-fixture';
  process.env.WECHAT_APP_SECRET = 'unused-fixture-secret';
  delete process.env.WECHAT_APP_SECRET_FILE;
  t.after(() => keys.forEach((key, index) => {
    const value = previous[index];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }));
  return { wechatFetch: async input => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.weixin.qq.com');
    return Response.json({ openid: `fixture-private-openid-${url.searchParams.get('js_code')}`, session_key: 'fixture-session-key' });
  } };
}

async function start(t: TestContext, options: AppConfig = {}) {
  const context = await createApp({ databasePath: ':memory:', environment: 'staging', uatMode: true, autoCloseIntervalMs: 0, ...mockWechat(t), ...options });
  t.after(() => context.app.close());
  return context;
}

async function call(context: Context, method: 'GET' | 'POST', path: string, token?: string, payload?: unknown) {
  const response = await context.app.inject({
    method,
    url: `/api${path}`,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  });
  return { status: response.statusCode, ...response.json() };
}

async function customer(context: Context, code = 'first-buyer') {
  const response = await call(context, 'POST', '/auth/wechat', undefined, { code });
  assert.equal(response.status, 200, JSON.stringify(response));
  return { token: response.data.token as string, id: response.data.user.id as string };
}

async function operator(context: Context, role: 'admin' | 'merchant' = 'admin') {
  const username = `uat.fixture.${role}`;
  await createManagementAccount(context.store, {
    username, password: managementPassword, role, ...(role === 'merchant' ? { merchantId: checkout.merchantId } : {}),
  });
  const response = await call(context, 'POST', '/auth/management/login', undefined, { username, password: managementPassword });
  assert.equal(response.status, 200, JSON.stringify(response));
  return response.data.token as string;
}

async function order(context: Context, token: string, requestId: string, productId = 'sam-p3', optionId = 'whole') {
  const response = await call(context, 'POST', '/orders', token, { ...checkout, requestId, items: [{ productId, optionId, quantity: 1 }] });
  assert.equal(response.status, 200, JSON.stringify(response));
  assert.equal(response.data.isTest, true);
  return response.data as Order;
}

test('production and ordinary staging reject test payment, supplement and test credit', async t => {
  const mocked = mockWechat(t);
  for (const environment of ['production', 'staging']) {
    const context = await createApp({ databasePath: ':memory:', environment, uatMode: false, seed: false, ...mocked });
    try {
      const buyer = await customer(context);
      const config = await call(context, 'GET', '/config', buyer.token);
      assert.equal(config.data.uatEnabled, false);
      assert.equal(config.data.testPaymentsEnabled, false);
      for (const path of ['/orders/arbitrary/pay', '/orders/arbitrary/topup']) {
        const response = await call(context, 'POST', path, buyer.token, { method: 'test' });
        assert.equal(response.status, 403, JSON.stringify(response));
      }
      assert.equal((await call(context, 'POST', '/wallet/test-credit', buyer.token, { amountCents: 1000, requestId: 'rejected-test-credit' })).status, 403);
      assert.equal((await call(context, 'POST', '/orders/arbitrary/pay', buyer.token, { method: 'wechat' })).error.code, 'WECHAT_PAY_NOT_CONFIGURED');
      assert.deepEqual(context.store.wallet(buyer.id), { balanceCents: 0, entries: [] });
    } finally {
      await context.app.close();
    }
  }
  await assert.rejects(() => createApp({ databasePath: ':memory:', environment: 'production', uatMode: true }), /UAT/);
});

test('only approved WeChat customers can pay or fund test wallets, and only a platform admin can approve them', async t => {
  await assert.rejects(() => createApp({ databasePath: ':memory:', environment: 'staging', uatMode: true, devAuthEnabled: true }), /UAT_DEV_FEATURES_FORBIDDEN/);
  const context = await start(t);
  const anonymousConfig = (await call(context, 'GET', '/config')).data;
  assert.equal(anonymousConfig.uatEnabled, true);
  assert.equal(anonymousConfig.environmentLabel, '线上测试环境');
  assert.equal(anonymousConfig.testPaymentsEnabled, false);
  assert.equal(anonymousConfig.devAuthEnabled, false);
  assert.equal(anonymousConfig.devPaymentsEnabled, false);
  assert.equal((await call(context, 'POST', '/auth/dev-login', undefined, { role: 'admin' })).status, 503);
  assert.equal(context.store.all('user').length, 0);
  const fixtures = (await call(context, 'GET', '/catalog')).data;
  assert.ok(fixtures.merchants[0].name.startsWith('测试'));
  assert.ok(fixtures.groups.length > 0 && fixtures.groups.every((group: { paidSlots: number; participants: unknown[] }) => group.paidSlots === 0 && group.participants.length === 0));

  const buyer = await customer(context);
  const merchant = await operator(context, 'merchant');
  const admin = await operator(context);
  const purchase = await order(context, buyer.token, 'pending-approval');
  const credit = { amountCents: 1000, requestId: 'permission-credit' };
  assert.equal((await call(context, 'POST', `/orders/${purchase.id}/pay`, buyer.token, { method: 'test' })).status, 403);
  assert.equal((await call(context, 'POST', `/orders/${purchase.id}/pay`, buyer.token, { method: 'wallet' })).status, 403);
  assert.equal((await call(context, 'POST', '/wallet/test-credit', buyer.token, credit)).status, 403);
  assert.equal((await call(context, 'POST', '/wallet/dev-credit', buyer.token, credit)).status, 403);
  assert.equal((await call(context, 'GET', '/admin/test-users', buyer.token)).status, 403);
  assert.equal((await call(context, 'GET', '/admin/test-users', merchant)).status, 403);
  assert.equal((await call(context, 'POST', `/admin/test-users/${buyer.id}`, merchant, { enabled: true })).status, 403);
  assert.equal((await call(context, 'POST', `/admin/test-users/${buyer.id}`, buyer.token, { enabled: true })).status, 403);

  const listed = await call(context, 'GET', '/admin/test-users', admin);
  assert.deepEqual(listed.data.map((item: { id: string; enabled: boolean }) => [item.id, item.enabled]), [[buyer.id, false]]);
  assert.doesNotMatch(JSON.stringify(listed.data), /openid|fixture-session-key/);
  assert.equal((await call(context, 'POST', `/admin/test-users/${buyer.id}`, admin, { enabled: 'true' })).status, 400);
  assert.equal((await call(context, 'POST', `/admin/test-users/${buyer.id}`, admin, { enabled: true })).data.enabled, true);
  assert.equal((await call(context, 'GET', '/config', buyer.token)).data.testPaymentsEnabled, true);
  assert.equal((await call(context, 'GET', '/config', admin)).data.testPaymentsEnabled, false);
  assert.equal((await call(context, 'POST', '/wallet/test-credit', buyer.token, credit)).data.balanceCents, 1000);
  assert.equal((await call(context, 'POST', `/admin/test-users/${buyer.id}`, admin, { enabled: false })).data.enabled, false);
  assert.equal((await call(context, 'GET', '/config', buyer.token)).data.testPaymentsEnabled, false);
  assert.equal((await call(context, 'POST', `/orders/${purchase.id}/pay`, buyer.token, { method: 'wallet' })).status, 403);
  assert.equal((await call(context, 'POST', `/orders/${purchase.id}/pay`, buyer.token, { method: 'test' })).status, 403);
  assert.equal((await call(context, 'GET', '/wallet', buyer.token)).data.balanceCents, 1000);
  assert.ok(context.store.db.prepare('SELECT event FROM security_audit').all().some(row => String(row.event).includes('uat')));
});

test('test payment and topup are idempotent and test wallet refunds reconcile', async t => {
  const context = await start(t);
  const buyer = await customer(context);
  const admin = await operator(context);
  await call(context, 'POST', `/admin/test-users/${buyer.id}`, admin, { enabled: true });
  const credit = { amountCents: 10000, requestId: 'test-wallet-100' };
  for (let retry = 0; retry < 2; retry++) {
    const response = await call(context, 'POST', '/wallet/test-credit', buyer.token, credit);
    assert.equal(response.data.balanceCents, 10000);
    assert.equal(response.data.isTest, true);
  }
  assert.equal((await call(context, 'POST', '/wallet/test-credit', buyer.token, { ...credit, amountCents: 9999 })).status, 409);

  const purchase = await order(context, buyer.token, 'test-checkout');
  const pay = () => call(context, 'POST', `/orders/${purchase.id}/pay`, buyer.token, { method: 'test' });
  const paid = await Promise.all([pay(), pay()]);
  assert.ok(paid.every(response => response.status === 200 && response.data.paymentMethod === 'test' && response.data.payments.length === 1));
  assert.equal((await call(context, 'GET', '/wallet', buyer.token)).data.balanceCents, 10000);
  const adjustment = await call(context, 'POST', `/admin/orders/${purchase.id}/weight-adjustment`, admin, { adjustmentId: 'test-weight-more', actualGoodsCents: 5000, note: '复核测试称重' });
  assert.equal(adjustment.status, 200, JSON.stringify(adjustment));
  assert.ok(adjustment.data.topupCents > 0);
  const topup = () => call(context, 'POST', `/orders/${purchase.id}/topup`, buyer.token, { method: 'test' });
  const supplemented = await Promise.all([topup(), topup()]);
  assert.ok(supplemented.every(response => response.status === 200 && response.data.topupCents === 0 && response.data.payments.length === 2));
  const settled = supplemented[0].data as Order;
  const refund = { requestId: 'refund-from-simulated-payment', amountCents: 300, reason: '测试部分退款' };
  for (let retry = 0; retry < 2; retry++) {
    const response = await call(context, 'POST', `/admin/orders/${purchase.id}/refund`, admin, refund);
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.equal(response.data.refundedCents, 300);
  }

  const split = await order(context, buyer.token, 'test-unfilled-group', 'sam-p1', 'split-half');
  assert.equal((await call(context, 'POST', `/orders/${split.id}/pay`, buyer.token, { method: 'wallet' })).status, 200);
  assert.equal((await call(context, 'GET', '/wallet', buyer.token)).data.balanceCents, 10300 - split.pricing.totalCents);
  const closed = await call(context, 'POST', `/admin/batches/${checkout.batchId}/close`, admin, {});
  assert.equal(closed.data.refundCents, split.pricing.totalCents);
  const wallet = (await call(context, 'GET', '/wallet', buyer.token)).data;
  assert.equal(wallet.balanceCents, 10300);
  assert.equal(wallet.entries.filter((entry: WalletEntry) => entry.kind === 'test_funding').length, 2);
  assert.equal(wallet.entries.filter((entry: WalletEntry) => entry.kind === 'test_credit').length, 1);
  assert.match(wallet.entries.find((entry: WalletEntry) => entry.kind === 'refund').note, /测试余额退款/);
  const reconciliation = (await call(context, 'GET', '/admin/reconciliation', admin)).data;
  assert.equal(reconciliation.isTest, true);
  assert.equal(reconciliation.testFundingCents, settled.paidCents);
  assert.deepEqual(reconciliation.discrepancies, []);
});

test('UAT with seed disabled keeps an empty catalog, and UAT data cannot reopen as production', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'sam-uat-ledger-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const databasePath = join(directory, 'uat.sqlite');
  const context = await createApp({ databasePath, environment: 'staging', uatMode: true, seed: false });
  try {
    assert.equal((await call(context, 'GET', '/catalog')).data.merchants.length, 0);
    assert.equal(context.store.all('user').length, 0);
  } finally {
    await context.app.close();
  }
  await assert.rejects(() => createApp({ databasePath, environment: 'production', uatMode: false }), /DATABASE|UAT/);
  await assert.rejects(() => createApp({ databasePath, environment: 'staging', uatMode: false }), /DATABASE|UAT/);
  const reopened = await createApp({ databasePath, environment: 'staging', uatMode: true, seed: false });
  await reopened.app.close();
});

test('UAT refuses an unmarked legacy production database that already contains a management account', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'sam-uat-refuse-prod-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const databasePath = join(directory, 'existing.sqlite');
  const oldStore = new Store(databasePath);
  try {
    await createManagementAccount(oldStore, { username: 'legacy.admin', password: managementPassword, role: 'admin' });
  } finally {
    oldStore.close();
  }
  await assert.rejects(() => createApp({ databasePath, environment: 'staging', uatMode: true, seed: false }), /DATABASE|UAT/);
  const untouched = new Store(databasePath);
  try {
    assert.equal(untouched.get('meta', 'runtime-database-v1'), undefined);
    assert.equal(untouched.managementAccount('legacy.admin')?.role, 'admin');
  } finally {
    untouched.close();
  }
});
