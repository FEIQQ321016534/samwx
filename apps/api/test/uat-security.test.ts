import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { User } from '../../../packages/domain/src/index.ts';
import { Store, sessionDigest, UAT_COMPATIBILITY_REASON } from '../src/db.ts';
import { createManagementAccount, initializeUatStore, isUatTester, listUatTesterApprovals, resolveRuntimeSecurity, setUatTesterApproval } from '../src/security.ts';

const staging = resolveRuntimeSecurity({ environment: 'staging', uatMode: true, devAuthEnabled: false, devPaymentsEnabled: false });
const production = resolveRuntimeSecurity({ environment: 'production', uatMode: false });
const fixturePassword = 'This password is used only in the UAT regression tests';
const buyer: User = { id: 'wechat-uat-security-fixture', nickname: '体验顾客', role: 'customer' };

test('the UAT marker guards legacy production and survives reopening the isolated database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wxsam-uat-marker-'));
  const filename = join(directory, 'isolated.sqlite');
  try {
    const first = new Store(filename);
    try {
      initializeUatStore(first, staging);
      assert.equal(first.runtimeDatabase()?.uatMode, true);
      assert.equal(first.get<{ reason: string }>('meta', 'seed-v1')?.reason, UAT_COMPATIBILITY_REASON);
      // The old production guard recognizes the same seed-v1 sentinel.
      assert.equal(first.hasDemoData(), true);
      assert.equal(first.hasDemoData(true), false);
      assert.deepEqual(first.all('user'), []);
      first.ledger(buyer.id, 1200, 'test-credit:fixture', 'test_credit', '测试资金');
    } finally { first.close(); }

    const reopened = new Store(filename);
    try {
      assert.throws(() => initializeUatStore(reopened, production), /PRODUCTION_UAT_DATABASE_FORBIDDEN/);
      assert.throws(() => initializeUatStore(reopened, { ...staging, uatMode: false }), /PRODUCTION_UAT_DATABASE_FORBIDDEN/);
      initializeUatStore(reopened, staging);
      assert.equal(reopened.wallet(buyer.id).balanceCents, 1200);
    } finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('staging cannot claim an unmarked legacy database containing only an administrator', async () => {
  const store = new Store(':memory:');
  try {
    const account = await createManagementAccount(store, { username: 'legacy.production.admin', password: fixturePassword, role: 'admin' });
    assert.throws(() => initializeUatStore(store, staging), /STAGING_DATABASE_NOT_EMPTY/);
    assert.equal(store.runtimeDatabase(), undefined);
    assert.equal(store.require<User>('user', account.user.id).role, 'admin');
    initializeUatStore(store, production);
    assert.throws(() => initializeUatStore(store, staging), /DATABASE_ENVIRONMENT_MISMATCH/);
  } finally { store.close(); }
});

test('production rejects unmarked test payment artifacts and cannot write new ones', () => {
  const store = new Store(':memory:');
  try {
    initializeUatStore(store, production);
    assert.throws(() => store.ledger(buyer.id, 1200, 'test-credit:bad', 'test_credit', '测试资金'), /测试资金只能保存在体验库/);
    assert.throws(() => store.put('order', { id: 'test-order', isTest: true }), /测试订单只能保存在体验库/);
    assert.deepEqual(store.wallet(buyer.id), { balanceCents: 0, entries: [] });
  } finally { store.close(); }

  for (const order of [{ isTest: true }, { paymentMethod: 'test' }, { payments: [{ method: 'test' }] }]) {
    const imported = new Store(':memory:');
    try {
      imported.db.prepare('INSERT INTO entities VALUES(?,?,?)').run('order', 'partial-copy', JSON.stringify({ id: 'partial-copy', ...order }));
      assert.throws(() => initializeUatStore(imported, production), /PRODUCTION_UAT_DATABASE_FORBIDDEN/);
    } finally { imported.close(); }
  }

  const importedLedger = new Store(':memory:');
  try {
    importedLedger.db.prepare('INSERT INTO wallet_entries VALUES(?,?,?,?,?,?,?,?,?,?)').run('copy', buyer.id, 1200, 1200, 'test-funding:copy', 'test_funding', '测试资金', new Date().toISOString(), null, null);
    assert.throws(() => initializeUatStore(importedLedger, production), /PRODUCTION_UAT_DATABASE_FORBIDDEN/);
  } finally { importedLedger.close(); }
});

test('both formal session sources retain their environment and copied rows fail across database instances', async () => {
  const source = new Store(':memory:');
  const anotherStaging = new Store(':memory:');
  const live = new Store(':memory:');
  try {
    initializeUatStore(source, staging);
    initializeUatStore(anotherStaging, staging);
    initializeUatStore(live, production);
    for (const store of [source, anotherStaging, live]) store.put('user', buyer);
    const customerToken = source.issueSession(buyer.id, { source: 'wechat', environment: 'staging' }).token;
    const staff = await createManagementAccount(source, { username: 'uat.security.operator', password: fixturePassword, role: 'admin' });
    const staffToken = source.issueSession(staff.user.id, { source: 'management', environment: 'staging' }).token;
    for (const [token, userId] of [[customerToken, buyer.id], [staffToken, staff.user.id]]) {
      assert.equal(source.session(token, { environment: 'staging' })?.id, userId);
      assert.equal(source.session(token, { environment: 'production' }), undefined);
      assert.equal(live.session(token, { environment: 'production' }), undefined);
    }
    assert.throws(() => source.issueSession(buyer.id, { source: 'wechat', environment: 'production' }), /登录环境与数据库不匹配/);

    const row = source.db.prepare('SELECT * FROM sessions WHERE user_id=?').get(buyer.id)!;
    assert.notEqual(row.token, sessionDigest(customerToken));
    for (const store of [anotherStaging, live]) {
      store.db.prepare('INSERT INTO sessions(token,user_id,expires_at,auth_source,auth_version,created_at,runtime_environment,db_scope) VALUES(?,?,?,?,?,?,?,?)')
        .run(row.token, row.user_id, row.expires_at, row.auth_source, row.auth_version, row.created_at, row.runtime_environment, row.db_scope);
      assert.equal(store.session(customerToken), undefined);
    }
    source.revokeSession(customerToken);
    assert.equal(source.session(customerToken), undefined);
  } finally { source.close(); anotherStaging.close(); live.close(); }
});

test('legacy formal session rows have no valid environment while accounts survive migration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wxsam-uat-legacy-session-'));
  const filename = join(directory, 'legacy.sqlite');
  const oldToken = randomBytes(32).toString('hex');
  try {
    const first = new Store(filename);
    try {
      first.put('user', buyer);
      first.db.prepare('INSERT INTO sessions(token,user_id,expires_at,auth_source) VALUES(?,?,?,?)')
        .run(sessionDigest(oldToken), buyer.id, Date.now() + 60_000, 'wechat');
    } finally { first.close(); }

    const reopened = new Store(filename);
    try {
      initializeUatStore(reopened, production);
      assert.equal(reopened.session(oldToken, { environment: 'production' }), undefined);
      assert.equal(reopened.require<User>('user', buyer.id).id, buyer.id);
      const freshToken = reopened.issueSession(buyer.id, { source: 'wechat', environment: 'production' }).token;
      assert.equal(reopened.session(freshToken, { environment: 'production' })?.id, buyer.id);
    } finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('UAT approval requires a stored WeChat identity and exposes registration time without identity secrets', async () => {
  const store = new Store(':memory:');
  try {
    initializeUatStore(store, staging);
    const { user: admin } = await createManagementAccount(store, { username: 'uat.security.approver', password: fixturePassword, role: 'admin' });
    store.put('user', buyer);
    assert.throws(() => setUatTesterApproval(store, admin, buyer.id, true, staging), /请先用真实微信登录/);
    const createdAt = '2026-11-04T00:00:00.000Z';
    store.put('wechat_identity', { id: 'identity-fixture', userId: buyer.id, openid: 'fixture-private-openid', appId: 'fixture-app', createdAt });
    const approval = setUatTesterApproval(store, admin, buyer.id, true, staging);
    assert.equal(approval.registeredAt, createdAt);
    assert.equal(isUatTester(store, buyer.id, staging), true);
    assert.doesNotMatch(JSON.stringify(listUatTesterApprovals(store, admin, staging)), /openid|fixture-app/);
    store.put('user', { ...buyer, disabledAt: createdAt });
    assert.equal(isUatTester(store, buyer.id, staging), false);
  } finally { store.close(); }
});
