import { DatabaseSync } from 'node:sqlite';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Merchant, User, Wallet, WalletEntry } from '../../../packages/domain/src/index.ts';

export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}
export function fail(statusCode: number, code: string, message: string): never { throw new ApiError(statusCode, code, message); }
export const uid = (prefix: string) => `${prefix}-${randomUUID()}`;
export const now = () => new Date().toISOString();
export type AuthSource = 'development' | 'wechat' | 'management';
export interface SessionOptions { environment?: string; allowedSources?: AuthSource[] }
export const RUNTIME_DATABASE_MARKER = 'runtime-database-v1';
export const UAT_COMPATIBILITY_REASON = 'UAT_COMPATIBILITY_GUARD';
export interface RuntimeDatabaseMarker { id: string; environment: string; uatMode: boolean; createdAt: string }
export interface ManagementAccount {
  username: string; user_id: string; password_hash: string; role: 'admin'|'merchant'; merchant_id: string|null;
  failed_attempts: number; failure_started_at: number; locked_until: number; disabled_at: number;
  auth_version: number; created_at: number; updated_at: number; last_login_at: number;
}
export const sessionDigest = (token: string) => `sha256:${createHash('sha256').update(token).digest('hex')}`;
function auditPayload(value: unknown, depth = 0): unknown {
  if(depth > 6)return '[depth limit]';
  if(Array.isArray(value))return value.slice(0,100).map(v=>auditPayload(v,depth+1));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/password|token|secret|authorization|cookie|session.key|openid|recipientPhone|recipientName|address/i.test(key)?'[REDACTED]':auditPayload(v,depth+1)]));
  return typeof value==='string'?value.slice(0,2000):value;
}

export class Store {
  db: DatabaseSync;
  private readonly sessionScope: string;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode:0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;
      CREATE TABLE IF NOT EXISTS entities(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL,auth_source TEXT NOT NULL DEFAULT 'development',auth_version INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL DEFAULT 0,runtime_environment TEXT NOT NULL DEFAULT 'legacy',db_scope TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS database_security_scope(singleton INTEGER PRIMARY KEY CHECK(singleton=1),scope_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS management_accounts(username TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','merchant')),merchant_id TEXT,failed_attempts INTEGER NOT NULL DEFAULT 0,failure_started_at INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0,disabled_at INTEGER NOT NULL DEFAULT 0,auth_version INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_login_at INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS security_rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS security_rate_expiry ON security_rate_limits(reset_at);
      CREATE TABLE IF NOT EXISTS security_audit(id TEXT PRIMARY KEY,event TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS wallet_accounts(user_id TEXT PRIMARY KEY,balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents>=0));
      CREATE TABLE IF NOT EXISTS wallet_entries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,balance_after_cents INTEGER NOT NULL,reference TEXT NOT NULL,kind TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL,merchant_id TEXT,order_id TEXT,UNIQUE(user_id,reference));
      CREATE INDEX IF NOT EXISTS wallet_entries_user ON wallet_entries(user_id,created_at);
    `);
    this.sessionScope = this.transaction(() => {
      const sessionColumns = (this.db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]).map(column => column.name);
      if (!sessionColumns.includes('auth_source')) this.db.exec("ALTER TABLE sessions ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'development'");
      if (!sessionColumns.includes('auth_version')) this.db.exec('ALTER TABLE sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0');
      if (!sessionColumns.includes('created_at')) this.db.exec('ALTER TABLE sessions ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0');
      if (!sessionColumns.includes('runtime_environment')) this.db.exec("ALTER TABLE sessions ADD COLUMN runtime_environment TEXT NOT NULL DEFAULT 'legacy'");
      if (!sessionColumns.includes('db_scope')) this.db.exec("ALTER TABLE sessions ADD COLUMN db_scope TEXT NOT NULL DEFAULT ''");

      this.db.prepare('INSERT OR IGNORE INTO database_security_scope VALUES (1,?)').run(randomUUID());
      const scope = (this.db.prepare('SELECT scope_id FROM database_security_scope WHERE singleton=1').get() as { scope_id: string }).scope_id;
      const legacy=this.db.prepare("SELECT token FROM sessions WHERE token NOT LIKE 'sha256:%'").all() as {token:string}[];
      for(const row of legacy){const digest=sessionDigest(row.token);this.db.prepare('UPDATE OR IGNORE sessions SET token=? WHERE token=?').run(digest,row.token);this.db.prepare('DELETE FROM sessions WHERE token=?').run(row.token);}
      // Historical development tokens stay local. Older formal tokens have no
      // provable environment and must be replaced by signing in again.
      this.db.prepare("UPDATE sessions SET runtime_environment='legacy-development',db_scope=? WHERE auth_source='development' AND runtime_environment='legacy' AND db_scope=''").run(scope);
      return scope;
    });
    if(path!==':memory:')for(const file of [path,`${path}-wal`,`${path}-shm`])if(existsSync(file))chmodSync(file,0o600);
  }
  close() { this.db.close(); }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT payload FROM entities WHERE kind=? AND id=?').get(kind, id) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) as T : undefined;
  }
  require<T>(kind: string, id: string): T { return this.get<T>(kind, id) ?? fail(404, 'NOT_FOUND', `${kind} 不存在`); }
  all<T>(kind: string): T[] { return (this.db.prepare('SELECT payload FROM entities WHERE kind=? ORDER BY rowid').all(kind) as {payload: string}[]).map(r => JSON.parse(r.payload) as T); }
  put<T extends { id: string }>(kind: string, value: T): T {
    return this.transaction(()=>{
      const next=value as unknown as Record<string,unknown>;
      const old=kind==='user'?this.get<User&{disabledAt?:string}>(kind,value.id):undefined;
      if (kind === 'order' && (next.isTest === true || next.paymentMethod === 'test' ||
          (Array.isArray(next.payments) && next.payments.some(payment => payment?.method === 'test'))) && !this.isUatDatabase()) {
        fail(409, 'UAT_ORDER_FORBIDDEN', '测试订单只能保存在体验库');
      }
      this.db.prepare('INSERT INTO entities(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload').run(kind, value.id, JSON.stringify(value));
      if(kind==='merchant'&&next.status!=='approved')this.revokeMerchantSessions(value.id);
      if(old&&(old.role!==next.role||old.merchantId!==next.merchantId||next.disabledAt))this.revokeUserSessions(value.id);
      return value;
    });
  }
  transaction<T>(action: () => T): T {
    if(this.db.isTransaction)return action();
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = action(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private sessionKey(token: string, database: RuntimeDatabaseMarker | undefined): string {
    // Older production readers use the plain token digest. A copied UAT row
    // must stay unrecognizable to them even without the database metadata.
    return database?.uatMode === true ? sessionDigest(`uat-v1:${this.sessionScope}:${token}`) : sessionDigest(token);
  }
  issueSession(userId:string,options:{source:AuthSource;ttlMs?:number;environment?:string}):{token:string;expiresAt:string} {
    const database = this.runtimeDatabase();
    const databaseEnvironment = database?.environment;
    const environment = options.environment ?? databaseEnvironment ?? process.env.NODE_ENV ?? 'production';
    if (databaseEnvironment && databaseEnvironment !== environment) fail(403, 'AUTH_ENVIRONMENT_MISMATCH', '登录环境与数据库不匹配');
    const user=this.require<User>('user',userId);
    const account=options.source==='management'?this.managementAccountForUser(userId):undefined;
    if(options.source==='management'&&(!account||account.disabled_at||account.locked_until>Date.now()||account.role!==user.role||account.merchant_id!==(user.merchantId??null)))fail(403,'ACCOUNT_UNAVAILABLE','管理账号不可用');
    if(options.source==='wechat'&&(user.role!=='customer'||user.id.startsWith('dev-')))fail(403,'INVALID_AUTH_SOURCE','微信身份仅用于顾客登录');
    if(options.source==='development'&&!['development','test'].includes(environment))fail(403,'DEV_AUTH_DISABLED','开发身份登录未启用');
    const ttl=Math.min(Math.max(options.ttlMs??(options.source==='management'?8*3600_000:24*3600_000),60_000),24*3600_000);
    const token=randomBytes(32).toString('hex');const timestamp=Date.now();const expiresAt=timestamp+ttl;
    this.db.prepare('INSERT INTO sessions(token,user_id,expires_at,auth_source,auth_version,created_at,runtime_environment,db_scope) VALUES(?,?,?,?,?,?,?,?)').run(this.sessionKey(token,database),userId,expiresAt,options.source,account?.auth_version??0,timestamp,environment,this.sessionScope);
    return {token,expiresAt:new Date(expiresAt).toISOString()};
  }
  session(token: string, options: SessionOptions|'wechat' = {}): User | undefined {
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return undefined;
    const opts=typeof options==='string'?{allowedSources:[options]}:options;
    const database = this.runtimeDatabase();
    const row = this.db.prepare('SELECT user_id,auth_source,auth_version,runtime_environment FROM sessions WHERE token=? AND db_scope=? AND expires_at>?').get(this.sessionKey(token,database),this.sessionScope,Date.now()) as {user_id: string;auth_source:AuthSource;auth_version:number;runtime_environment:string} | undefined;
    if(!row||opts.allowedSources&&!opts.allowedSources.includes(row.auth_source))return undefined;
    const databaseEnvironment = database?.environment;
    const environment = opts.environment ?? databaseEnvironment ?? process.env.NODE_ENV ?? 'production';
    if (databaseEnvironment && databaseEnvironment !== environment) return undefined;
    const legacyDevelopment = row.auth_source === 'development' && row.runtime_environment === 'legacy-development' && ['development','test'].includes(environment);
    if (row.runtime_environment !== environment && !legacyDevelopment) return undefined;
    if(row.auth_source==='development'&&!['development','test'].includes(environment))return undefined;
    if(!['development','wechat','management'].includes(row.auth_source))return undefined;
    const user=this.get<User&{disabledAt?:string}>('user',row.user_id);if(!user||user.disabledAt)return undefined;
    if(row.auth_source==='wechat'&&(user.role!=='customer'||user.id.startsWith('dev-')))return undefined;
    if(row.auth_source==='management'){
      const account=this.managementAccountForUser(user.id);
      if(!account||account.disabled_at||account.locked_until>Date.now()||account.auth_version!==row.auth_version||account.role!==user.role||account.merchant_id!==(user.merchantId??null))return undefined;
    }
    if(user.role==='merchant'&&(!user.merchantId||this.get<Merchant>('merchant',user.merchantId)?.status!=='approved'))return undefined;
    return user;
  }
  revokeSession(token:string) { this.db.prepare('DELETE FROM sessions WHERE token=?').run(this.sessionKey(token,this.runtimeDatabase())); }
  revokeUserSessions(userId:string) { this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId); }
  revokeMerchantSessions(merchantId:string) { this.db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM entities WHERE kind='user' AND json_extract(payload,'$.merchantId')=?)").run(merchantId); }
  managementAccount(username:string):ManagementAccount|undefined {return this.db.prepare('SELECT * FROM management_accounts WHERE username=?').get(username) as ManagementAccount|undefined;}
  managementAccountForUser(userId:string):ManagementAccount|undefined {return this.db.prepare('SELECT * FROM management_accounts WHERE user_id=?').get(userId) as ManagementAccount|undefined;}
  audit(event:string,payload:Record<string,unknown>={}) {this.db.prepare('INSERT INTO security_audit VALUES(?,?,?,?)').run(uid('audit'),event.slice(0,100),JSON.stringify(auditPayload(payload)),now());}
  consumeRateLimit(key:string,limit:number,windowMs:number,timestamp=Date.now()):{allowed:boolean;retryAfterSeconds:number} {
    const digest=createHash('sha256').update(key).digest('hex');
    return this.transaction(()=>{
      this.db.prepare('DELETE FROM security_rate_limits WHERE reset_at<=?').run(timestamp);
      this.db.prepare('INSERT INTO security_rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(digest,timestamp+windowMs);
      const row=this.db.prepare('SELECT count,reset_at FROM security_rate_limits WHERE key=?').get(digest) as {count:number;reset_at:number};
      return{allowed:row.count<=limit,retryAfterSeconds:Math.max(1,Math.ceil((row.reset_at-timestamp)/1000))};
    });
  }
  runtimeDatabase(): RuntimeDatabaseMarker | undefined {
    return this.get<RuntimeDatabaseMarker>('meta', RUNTIME_DATABASE_MARKER);
  }
  isUatDatabase(): boolean {
    const marker = this.runtimeDatabase();
    return marker?.environment === 'staging' && marker.uatMode === true &&
      this.get<{ reason?: string }>('meta', 'seed-v1')?.reason === UAT_COMPATIBILITY_REASON;
  }
  private hasPaymentMethod(method: 'dev' | 'test'): boolean {
    return Boolean(this.db.prepare(`SELECT 1 FROM entities AS order_entity
      WHERE kind='order' AND (json_extract(payload,'$.paymentMethod')=? OR EXISTS (
        SELECT 1 FROM json_each(order_entity.payload,'$.payments') AS payment
        WHERE CASE WHEN payment.type='object' THEN json_extract(payment.value,'$.method') END=?
      )) LIMIT 1`).get(method,method));
  }
  hasDemoData(allowUatCompatibilityMarker = false): boolean {
    const seedMarker = this.get<{ reason?: string }>('meta', 'seed-v1');
    const demoSeed = seedMarker && !(allowUatCompatibilityMarker && seedMarker.reason === UAT_COMPATIBILITY_REASON);
    return Boolean(demoSeed || this.db.prepare("SELECT 1 FROM entities WHERE kind='user' AND id GLOB 'dev-*' LIMIT 1").get() ||
      this.db.prepare("SELECT 1 FROM wallet_entries WHERE kind='dev_credit' LIMIT 1").get() || this.hasPaymentMethod('dev'));
  }
  hasUatData(): boolean {
    return Boolean(this.runtimeDatabase()?.uatMode || this.get('meta','seed-uat-catalog-v1') ||
      this.get<{ reason?: string }>('meta','seed-v1')?.reason === UAT_COMPATIBILITY_REASON ||
      this.db.prepare("SELECT 1 FROM entities WHERE kind='uat_tester' OR (kind='order' AND json_extract(payload,'$.isTest')=1) LIMIT 1").get() ||
      this.db.prepare("SELECT 1 FROM wallet_entries WHERE kind GLOB 'test_*' OR reference GLOB 'test-*' LIMIT 1").get() || this.hasPaymentMethod('test'));
  }
  hasBusinessData(): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM entities WHERE kind<>'meta' LIMIT 1").get() ||
      this.db.prepare('SELECT 1 FROM management_accounts LIMIT 1').get() ||
      this.db.prepare('SELECT 1 FROM wallet_accounts LIMIT 1').get() || this.db.prepare('SELECT 1 FROM wallet_entries LIMIT 1').get() ||
      this.db.prepare('SELECT 1 FROM sessions LIMIT 1').get());
  }
  wallet(userId: string): Wallet {
    const account = this.db.prepare('SELECT balance_cents FROM wallet_accounts WHERE user_id=?').get(userId) as {balance_cents: number} | undefined;
    const rows = this.db.prepare('SELECT * FROM wallet_entries WHERE user_id=? ORDER BY rowid DESC').all(userId) as Record<string, unknown>[];
    const balance=account?.balance_cents??0;
    let total=0;for(const row of [...rows].reverse()){total+=Number(row.amount_cents);if(!Number.isSafeInteger(total)||total<0||total!==row.balance_after_cents)fail(409,'WALLET_INTEGRITY_ERROR','余额账本需要人工核对，当前禁止变动');}
    if(!Number.isSafeInteger(balance)||balance<0||balance!==total)fail(409,'WALLET_INTEGRITY_ERROR','余额账本需要人工核对，当前禁止变动');
    return { balanceCents: balance, entries: rows.map(r => ({id:r.id,userId:r.user_id,amountCents:r.amount_cents,balanceAfterCents:r.balance_after_cents,reference:r.reference,kind:r.kind,note:r.note,createdAt:r.created_at,merchantId:r.merchant_id ?? undefined,orderId:r.order_id ?? undefined} as WalletEntry)) };
  }
  ledger(userId: string, amountCents: number, reference: string, kind: string, note: string, merchantId?: string, orderId?: string): boolean {
    return this.transaction(()=>{
    if ((kind.startsWith('test_') || reference.startsWith('test-')) && !this.isUatDatabase()) fail(409,'UAT_LEDGER_FORBIDDEN','测试资金只能保存在体验库');
    if (!Number.isSafeInteger(amountCents)) fail(400, 'INVALID_AMOUNT', '钱包变动必须为整数分');
    const existing = this.db.prepare('SELECT amount_cents,kind,merchant_id,order_id FROM wallet_entries WHERE user_id=? AND reference=?').get(userId, reference) as {amount_cents: number;kind:string;merchant_id:string|null;order_id:string|null} | undefined;
    if (existing) { if (existing.amount_cents !== amountCents||existing.kind!==kind||existing.merchant_id!==(merchantId??null)||existing.order_id!==(orderId??null)) fail(409, 'IDEMPOTENCY_CONFLICT', '同一操作标识的金额或归属发生变化'); return false; }
    const current=this.wallet(userId).balanceCents;const next=current+amountCents;if(!Number.isSafeInteger(next))fail(400,'INVALID_AMOUNT','余额超出安全整数范围');
    this.db.prepare('INSERT OR IGNORE INTO wallet_accounts(user_id,balance_cents) VALUES(?,0)').run(userId);
    const changed = this.db.prepare('UPDATE wallet_accounts SET balance_cents=balance_cents+? WHERE user_id=? AND balance_cents+?>=0').run(amountCents,userId,amountCents);
    if (changed.changes !== 1) fail(409,'INSUFFICIENT_BALANCE','余额不足');
    const balance = next;
    this.db.prepare('INSERT INTO wallet_entries VALUES(?,?,?,?,?,?,?,?,?,?)').run(uid('led'),userId,amountCents,balance,reference,kind,note,now(),merchantId ?? null,orderId ?? null);
    return true;
    });
  }
}
