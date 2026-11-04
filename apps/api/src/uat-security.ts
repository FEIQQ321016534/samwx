import type { User } from '../../../packages/domain/src/index.ts';
import { fail, now, RUNTIME_DATABASE_MARKER, Store, UAT_COMPATIBILITY_REASON, type RuntimeDatabaseMarker } from './db.ts';
import type { RuntimeSecurity } from './security.ts';

export function resolveRuntimeDatabasePath(runtime: RuntimeSecurity, explicit?: string): string {
  const configured = explicit ?? process.env.DATABASE_PATH;
  if (configured) return configured;
  if (runtime.uatMode) return './data/sam-uat.sqlite';
  if (runtime.environment === 'staging') return './data/sam-staging.sqlite';
  if (runtime.environment === 'test') return ':memory:';
  return runtime.development ? './data/sam.sqlite' : './data/sam-production.sqlite';
}

export function initializeUatStore(store: Store, runtime: RuntimeSecurity): void {
  store.transaction(() => {
    if (runtime.uatMode && (runtime.environment !== 'staging' || runtime.devAuthEnabled || runtime.devPaymentsEnabled)) {
      throw new Error('UAT_STAGING_REQUIRED: 体验测试需要关闭开发开关的 staging 环境');
    }
    if (!runtime.uatMode && store.hasUatData()) {
      throw new Error('PRODUCTION_UAT_DATABASE_FORBIDDEN: 体验库和测试账本只能在显式体验环境使用');
    }
    if (!runtime.development && store.hasDemoData(runtime.uatMode)) {
      throw new Error('PRODUCTION_DEMO_DATABASE_FORBIDDEN: 正式和体验环境拒绝开发演示数据及开发资金账本');
    }
    const marker = store.runtimeDatabase();
    if (marker && (marker.environment !== runtime.environment || marker.uatMode !== runtime.uatMode)) {
      throw new Error('DATABASE_ENVIRONMENT_MISMATCH: 当前环境必须使用独立数据库');
    }
    if (!marker) {
      // Claim the empty database before provisioning an administrator. An old
      // production database can contain only credentials and no business data.
      if (runtime.environment === 'staging' && store.hasBusinessData()) {
        throw new Error('STAGING_DATABASE_NOT_EMPTY: 请为预发或体验环境创建独立数据库');
      }
      store.put<RuntimeDatabaseMarker>('meta', {
        id: RUNTIME_DATABASE_MARKER, environment: runtime.environment, uatMode: runtime.uatMode, createdAt: now(),
      });
    }
    if (runtime.uatMode && !store.get('meta', 'seed-v1')) {
      // Older production builds already reject this marker. It does not seed
      // users or balances. The UAT catalog has its own separate seed marker.
      store.put('meta', { id: 'seed-v1', createdAt: now(), reason: UAT_COMPATIBILITY_REASON });
    }
  });
}

interface UatTesterApproval { id: string; approved: boolean; updatedAt: string; updatedBy: string }
interface UatTesterSummary { id: string; nickname: string; approved: boolean; registeredAt?: string; updatedAt?: string; updatedBy?: string }
type StoredUser = User & { disabledAt?: string };
type UatCustomer = StoredUser & { registeredAt?: string };

function activeUat(store: Store, runtime: RuntimeSecurity): boolean {
  return runtime.uatMode && runtime.environment === 'staging' && store.isUatDatabase();
}

function wechatCustomer(store: Store, userId: string): UatCustomer | undefined {
  const user = store.get<StoredUser>('user', userId);
  if (user?.role !== 'customer' || user.disabledAt || !user.id.startsWith('wechat-')) return;
  const identity = store.db.prepare(`SELECT json_extract(payload,'$.createdAt') AS registered_at FROM entities WHERE kind='wechat_identity'
    AND json_extract(payload,'$.userId')=? AND json_type(payload,'$.openid')='text'
    AND length(json_extract(payload,'$.openid'))>0 ORDER BY rowid DESC LIMIT 1`).get(userId);
  if (!identity) return;
  return { ...user, registeredAt: typeof identity.registered_at === 'string' ? identity.registered_at : undefined };
}

function requireUatAdmin(store: Store, actor: User, runtime: RuntimeSecurity): void {
  if (!activeUat(store, runtime)) fail(403, 'UAT_NOT_ENABLED', '体验测试未启用');
  const user = store.get<StoredUser>('user', actor.id);
  const account = store.managementAccountForUser(actor.id);
  if (actor.role !== 'admin' || user?.role !== 'admin' || user.disabledAt || account?.role !== 'admin' ||
      account.merchant_id !== null || account.disabled_at || account.locked_until > Date.now()) {
    fail(403, 'UAT_ADMIN_REQUIRED', '只有有效的平台管理员可以审批体验顾客');
  }
}

function testerSummary(store: Store, user: UatCustomer): UatTesterSummary {
  const approval = store.get<UatTesterApproval>('uat_tester', user.id);
  return { id: user.id, nickname: user.nickname, approved: approval?.approved === true,
    ...(user.registeredAt && { registeredAt: user.registeredAt }),
    ...(approval && { updatedAt: approval.updatedAt, updatedBy: approval.updatedBy }) };
}

export function isUatTester(store: Store, userId: string, runtime: RuntimeSecurity): boolean {
  return activeUat(store, runtime) && Boolean(wechatCustomer(store, userId)) &&
    store.get<UatTesterApproval>('uat_tester', userId)?.approved === true;
}

export function assertUatTester(store: Store, userId: string, runtime: RuntimeSecurity): void {
  if (!activeUat(store, runtime)) fail(403, 'UAT_NOT_ENABLED', '体验测试未启用');
  if (!isUatTester(store, userId, runtime)) fail(403, 'UAT_TESTER_NOT_APPROVED', '当前微信账号尚未获准体验测试付款');
}

export function listUatTesterApprovals(store: Store, actor: User, runtime: RuntimeSecurity): UatTesterSummary[] {
  requireUatAdmin(store, actor, runtime);
  return store.all<User>('user').flatMap(user => {
    const customer = wechatCustomer(store, user.id);
    return customer ? [testerSummary(store, customer)] : [];
  });
}

export function setUatTesterApproval(store: Store, actor: User, userId: string, approved: boolean, runtime: RuntimeSecurity): UatTesterSummary {
  return store.transaction(() => {
    requireUatAdmin(store, actor, runtime);
    const user = wechatCustomer(store, userId);
    if (!user) fail(404, 'UAT_CUSTOMER_NOT_FOUND', '请先用真实微信登录体验版，再审批该顾客');
    const previous = store.get<UatTesterApproval>('uat_tester', userId);
    if (previous?.approved !== approved) {
      store.put<UatTesterApproval>('uat_tester', { id: userId, approved, updatedAt: now(), updatedBy: actor.id });
      store.audit(approved ? 'uat.tester.approved' : 'uat.tester.revoked', { userId, actorId: actor.id });
    }
    return testerSummary(store, user);
  });
}
