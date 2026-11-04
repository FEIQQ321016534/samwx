import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { FastifyInstance } from 'fastify';
import type { LogFn } from 'pino';
import type { Batch, Community, Merchant, Product, SplitGroup, User } from '../../../packages/domain/src/index.ts';
import { fail, now, Store, uid, type ManagementAccount } from './db.ts';

// Node's memory-hard KDF, using OWASP's scrypt N=2^17,r=8,p=1 profile.
// https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const SCRYPT = { N:131072, r:8, p:1, maxmem:256*1024*1024 };
const LOCK_WINDOW_MS=15*60_000;
const MAX_FAILURES=5;
const hashIdentifier=(value:string)=>createHash('sha256').update(value).digest('hex');
function derive(password:string,salt:Buffer):Promise<Buffer> {return new Promise((resolve,reject)=>scrypt(password,salt,64,SCRYPT,(error,key)=>error?reject(error):resolve(key)));}
function validatePassword(password:unknown):asserts password is string {
  if(typeof password!=='string'||[...password].length<15||[...password].length>256||Buffer.byteLength(password,'utf8')>1024)fail(400,'INVALID_PASSWORD','密码须为15至256个字符，可使用空格及中文');
}
export async function hashPassword(password:string):Promise<string> {
  validatePassword(password);const salt=randomBytes(16);const key=await derive(password,salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function verifyPassword(password:unknown,encoded?:string):Promise<boolean> {
  const pieces=encoded?.split('$');
  const valid=pieces?.length===6&&pieces[0]==='scrypt'&&pieces[1]==='131072'&&pieces[2]==='8'&&pieces[3]==='1'&&/^[A-Za-z0-9_-]{22}$/.test(pieces[4])&&/^[A-Za-z0-9_-]{86}$/.test(pieces[5]);
  const salt=valid?Buffer.from(pieces![4],'base64url'):Buffer.alloc(16);
  const expected=valid?Buffer.from(pieces![5],'base64url'):Buffer.alloc(64);
  const input=typeof password==='string'&&Buffer.byteLength(password,'utf8')<=1024?password:'';
  const actual=await derive(input,salt);
  return Boolean(valid&&timingSafeEqual(actual,expected));
}
export function normalizeUsername(value:unknown):string {
  if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/.test(value))fail(400,'INVALID_USERNAME','账号须为3至64位英文字母、数字、点、短横线或下划线');
  return value.toLowerCase();
}
export async function createManagementAccount(store:Store,input:{username:string;password:string;role:'admin'|'merchant';merchantId?:string;nickname?:string}):Promise<{username:string;user:User}> {
  const username=normalizeUsername(input.username);
  if(!['admin','merchant'].includes(input.role))fail(400,'INVALID_ROLE','管理账号仅支持平台管理员或商户运营');
  if(input.role==='admin'&&input.merchantId)fail(400,'INVALID_ROLE','平台管理员不能绑定商户');
  if(input.role==='merchant'){if(!input.merchantId)fail(400,'MERCHANT_REQUIRED','商户账号须绑定已存在的商户');store.require<Merchant>('merchant',input.merchantId);}
  if(input.nickname!==undefined&&(typeof input.nickname!=='string'||!input.nickname.trim()||input.nickname.length>80))fail(400,'INVALID_NICKNAME','显示名须为1至80个字符');
  const encoded=await hashPassword(input.password);
  return store.transaction(()=>{
    if(store.managementAccount(username))fail(409,'ACCOUNT_EXISTS','管理账号已存在');
    const user:User={id:uid('staff'),nickname:input.nickname?.trim()||(input.role==='admin'?'平台运营':'商户运营'),role:input.role,...(input.merchantId?{merchantId:input.merchantId}:{})};
    const at=Date.now();store.put('user',user);
    store.db.prepare('INSERT INTO management_accounts(username,user_id,password_hash,role,merchant_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(username,user.id,encoded,input.role,input.merchantId??null,at,at);
    store.audit('management.account.created',{userId:user.id,role:user.role,merchantId:user.merchantId,usernameHash:hashIdentifier(username),channel:'local-cli'});
    return{username,user};
  });
}
export async function resetManagementPassword(store:Store,usernameInput:string,password:string):Promise<void> {
  const username=normalizeUsername(usernameInput);const encoded=await hashPassword(password);
  store.transaction(()=>{const account=store.managementAccount(username);if(!account)fail(404,'ACCOUNT_NOT_FOUND','管理账号不存在');
    store.db.prepare('UPDATE management_accounts SET password_hash=?,auth_version=auth_version+1,failed_attempts=0,failure_started_at=0,locked_until=0,updated_at=? WHERE username=?').run(encoded,Date.now(),username);
    store.revokeUserSessions(account.user_id);store.audit('management.password.reset',{userId:account.user_id,channel:'local-cli'});
  });
}
export function setManagementAccountState(store:Store,usernameInput:string,action:'disable'|'enable'|'unlock'):void {
  const username=normalizeUsername(usernameInput);
  store.transaction(()=>{const account=store.managementAccount(username);if(!account)fail(404,'ACCOUNT_NOT_FOUND','管理账号不存在');
    if(action==='disable')store.db.prepare('UPDATE management_accounts SET disabled_at=?,auth_version=auth_version+1,updated_at=? WHERE username=?').run(Date.now(),Date.now(),username);
    else if(action==='enable')store.db.prepare('UPDATE management_accounts SET disabled_at=0,failed_attempts=0,failure_started_at=0,locked_until=0,auth_version=auth_version+1,updated_at=? WHERE username=?').run(Date.now(),username);
    else store.db.prepare('UPDATE management_accounts SET failed_attempts=0,failure_started_at=0,locked_until=0,auth_version=auth_version+1,updated_at=? WHERE username=?').run(Date.now(),username);
    store.revokeUserSessions(account.user_id);store.audit(`management.account.${action}`,{userId:account.user_id,channel:'local-cli'});
  });
}

export interface RuntimeSecurity {environment:string;development:boolean;devAuthEnabled:boolean;devPaymentsEnabled:boolean;uatMode:boolean}
export function resolveRuntimeSecurity(config:{environment?:string;devAuthEnabled?:boolean;devPaymentsEnabled?:boolean;uatMode?:boolean}={}):RuntimeSecurity {
  const environment=config.environment??process.env.NODE_ENV??'production';
  if(!['development','test','staging','production'].includes(environment))throw new Error('INVALID_RUNTIME_ENVIRONMENT: NODE_ENV须为development、test、staging或production，未设置时按production运行');
  const configuredUat = process.env.UAT_MODE;
  if(configuredUat!==undefined && configuredUat!=='' && configuredUat!=='true' && configuredUat!=='false')throw new Error('INVALID_UAT_MODE: UAT_MODE 仅接受 true 或 false');
  const uatMode=config.uatMode??configuredUat==='true';
  if(uatMode && environment!=='staging')throw new Error('UAT_STAGING_REQUIRED: 体验测试仅允许显式 staging 环境');
  const requestedDevAuth=config.devAuthEnabled??process.env.DEV_AUTH_ENABLED==='true';
  const requestedDevPayments=config.devPaymentsEnabled??process.env.DEV_PAYMENTS_ENABLED==='true';
  if(uatMode && (requestedDevAuth||requestedDevPayments))throw new Error('UAT_DEV_FEATURES_FORBIDDEN: 体验环境必须关闭开发登录与开发付款');
  const development=environment==='development'||environment==='test';
  const devAuthEnabled=development&&requestedDevAuth;
  const devPaymentsEnabled=development&&requestedDevPayments;
  const host=process.env.HOST??'127.0.0.1';
  if(development&&(devAuthEnabled||devPaymentsEnabled)&&!['127.0.0.1','::1','localhost'].includes(host))throw new Error('DEVELOPMENT_PUBLIC_BIND_FORBIDDEN: 开发身份与模拟资金仅允许绑定本机回环地址');
  return{environment,development,devAuthEnabled,devPaymentsEnabled,uatMode};
}
export { resolveRuntimeDatabasePath, initializeUatStore, isUatTester, assertUatTester, listUatTesterApprovals, setUatTesterApproval } from './uat-security.ts';
/** Only explicitly configured proxy IPs may supply the client-IP header chain. */
export function resolveTrustedProxyCidrs(value:string|string[]|undefined=process.env.TRUST_PROXY_CIDRS):false|string[] {
  const entries=(Array.isArray(value)?value:value?.split(',')??[]).map(item=>item.trim()).filter(Boolean);
  if(!entries.length)return false;
  return [...new Set(entries.map(entry=>{
    const parts=entry.split('/');const version=isIP(parts[0]);const max=version===4?32:128;
    if(!version||parts.length>2)throw new Error('INVALID_TRUST_PROXY_CIDRS: 仅允许显式代理IP或CIDR，不接受true、通配符或主机名');
    const prefix=parts.length===1?max:Number(parts[1]);
    if(!Number.isInteger(prefix)||prefix<=0||prefix>max||parts[0]==='0.0.0.0'||parts[0]==='::')throw new Error('INVALID_TRUST_PROXY_CIDRS: 不允许信任所有来源，请仅指定受控代理IP/CIDR');
    return `${parts[0]}/${prefix}`;
  }))];
}
export const securityLoggerOptions={
  level:'info',
  redact:{paths:['password','newPassword','currentPassword','token','appSecret','session_key','authorization','body','headers.authorization','headers.cookie','req.headers.authorization','req.headers.cookie','req.body','res.headers["set-cookie"]'],censor:'[REDACTED]'},
  serializers:{
    req:(request:{method?:string;url?:string;id?:string})=>({method:request.method,path:request.url?.split('?')[0],id:request.id}),
    res:(reply:{statusCode?:number})=>({statusCode:reply.statusCode}),
    err:(error:{name?:string;code?:string;statusCode?:number})=>({type:error.name??'Error',code:error.code,statusCode:error.statusCode,message:'Request failed; inspect the audited operation and request ID',stack:''}),
  },
  hooks:{logMethod(args:Parameters<LogFn>,method:LogFn){
    // Pino otherwise copies Error.message into the top-level msg even after an
    // err serializer removes it. Upstream fetch errors can contain secret URLs.
    if(args[0] instanceof Error)return method.call(this,{err:args[0]},'Request failed; inspect the audited operation and request ID');
    return method.apply(this,args);
  }},
};

function accountIdentityValid(store:Store,account:ManagementAccount):User|undefined {
  const user=store.get<User&{disabledAt?:string}>('user',account.user_id);
  if(!user||user.disabledAt||user.role!==account.role||(user.merchantId??null)!==account.merchant_id)return undefined;
  if(user.role==='merchant'&&(!user.merchantId||store.get<Merchant>('merchant',user.merchantId)?.status!=='approved'))return undefined;
  return user;
}
export function assertActiveUser(store:Store,user:User):void {
  if(user.role==='merchant'&&(!user.merchantId||store.get<Merchant>('merchant',user.merchantId)?.status!=='approved'))fail(403,'MERCHANT_INACTIVE','商户账号已暂停或尚未通过审核');
}

/** Register on the root Fastify instance before ready(); no new dependency. */
export function registerSecurity(app:FastifyInstance,store:Store,runtime:RuntimeSecurity):void {
  let activePasswordChecks=0;
  app.addHook('onRequest',async(request,reply)=>{
    const path=request.url.split('?')[0];
    const limit=store.consumeRateLimit(`http:${request.ip}`,600,60_000);
    if(!limit.allowed){reply.header('Retry-After',String(limit.retryAfterSeconds));fail(429,'RATE_LIMITED','请求过于频繁，请稍后重试');}
    if(path.startsWith('/api/auth/')&&request.method==='POST'){
      const authLimit=store.consumeRateLimit(`auth:${request.ip}`,30,15*60_000);
      if(!authLimit.allowed){reply.header('Retry-After',String(authLimit.retryAfterSeconds));fail(429,'AUTH_RATE_LIMITED','登录请求过于频繁，请稍后重试');}
    }
  });
  app.addHook('onSend',async(request,reply,payload)=>{
    reply.header('X-Content-Type-Options','nosniff');reply.header('Referrer-Policy','no-referrer');
    if(request.url.startsWith('/api/'))reply.header('Cache-Control','no-store');
    return payload;
  });
  app.post('/api/auth/management/login',async(request)=>{
    const body=request.body as {username?:unknown;password?:unknown}|undefined;
    if(!body||typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>64||Buffer.byteLength(body.password)>1024)fail(401,'INVALID_CREDENTIALS','账号或密码错误，或账号暂不可用');
    const username=body.username.toLowerCase();
    const account=store.managementAccount(username);
    if(activePasswordChecks>=2)fail(503,'AUTH_BUSY','登录服务繁忙，请稍后重试');
    activePasswordChecks++;
    let matches=false;try{matches=await verifyPassword(body.password,account?.password_hash);}finally{activePasswordChecks--;}
    const result=store.transaction(()=>{
      const latest=store.managementAccount(username);const timestamp=Date.now();
      const user=latest&&accountIdentityValid(store,latest);
      const usable=latest&&account&&latest.auth_version===account.auth_version&&latest.password_hash===account.password_hash&&!latest.disabled_at&&latest.locked_until<=timestamp&&user;
      if(!matches||!usable){
        if(latest&&!latest.disabled_at&&latest.locked_until<=timestamp){
          const withinWindow=timestamp-latest.failure_started_at<LOCK_WINDOW_MS;
          const count=withinWindow?latest.failed_attempts+1:1;
          const locked=count>=MAX_FAILURES;
          store.db.prepare('UPDATE management_accounts SET failed_attempts=?,failure_started_at=?,locked_until=?,auth_version=auth_version+?,updated_at=? WHERE username=?').run(count,withinWindow?latest.failure_started_at:timestamp,locked?timestamp+LOCK_WINDOW_MS:0,locked?1:0,timestamp,username);
          if(locked)store.revokeUserSessions(latest.user_id);
        }
        store.audit('management.login.failed',{usernameHash:hashIdentifier(username),ipHash:hashIdentifier(request.ip)});
        return undefined;
      }
      store.db.prepare('UPDATE management_accounts SET failed_attempts=0,failure_started_at=0,locked_until=0,last_login_at=?,updated_at=? WHERE username=?').run(timestamp,timestamp,username);
      const session=store.issueSession(user!.id,{source:'management',environment:runtime.environment});
      store.audit('management.login.succeeded',{userId:user!.id,ipHash:hashIdentifier(request.ip)});
      return{...session,user};
    });
    if(!result)fail(401,'INVALID_CREDENTIALS','账号或密码错误，或账号暂不可用');
    return{data:result};
  });
  app.post('/api/auth/management/logout-all',async(request)=>{
    const token=request.headers.authorization?.startsWith('Bearer ')?request.headers.authorization.slice(7):'';
    const user=store.session(token,{environment:runtime.environment,allowedSources:['management']});if(!user)fail(401,'UNAUTHORIZED','请先登录管理账号');
    store.revokeUserSessions(user.id);store.audit('management.sessions.revoked',{userId:user.id});return{data:{ok:true}};
  });
}

const pick=(input:object,keys:string[]):Record<string,unknown>=>Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(input,key)).map(key=>[key,(input as Record<string,unknown>)[key]]));
const safeText=(value:unknown)=>typeof value==='string'?value.replace(/1[3-9]\d{9}/g,'[联系方式已隐藏]'):value;
const optionFields=['id','name','ratio','slots','weightEstimate','priceCents','description'];
export function publicGroup(group:SplitGroup):Record<string,unknown> {
  const safe=pick(group,['id','merchantId','productId','optionId','batchId','communityId','productName','totalSlots','paidSlots','pricePerSlotCents','slotDescription','status','cutoffAt','createdAt','note']);
  for(const key of ['productName','slotDescription','note'])if(key in safe)safe[key]=safeText(safe[key]);
  safe.participants=group.participants.map(p=>({nickname:p.nickname?[...p.nickname][0]+'**':'拼友',quantity:p.quantity}));
  const snapshot=(group as unknown as Record<string,unknown>).optionSnapshot;
  if(snapshot&&typeof snapshot==='object')safe.optionSnapshot=pick(snapshot,optionFields);
  return safe;
}
export function publicCatalog(input:{merchants:Merchant[];communities:Community[];batches:Batch[];products:Product[];groups:SplitGroup[]}):Record<string,unknown> {
  return{
    merchants:input.merchants.map(m=>({...pick(m,['id','name','city','status']),description:safeText(m.description)})),
    communities:input.communities.map(c=>{const safe=pick(c,['id','merchantId','name','station','address']);for(const k of ['name','station','address'])safe[k]=safeText(safe[k]);return safe;}),
    batches:input.batches.map(b=>{const safe=pick(b,['id','merchantId','title','storeName','cutoffAt','pickupStartAt','pickupEndAt','status','closedAt','shopperName']);for(const key of ['title','storeName','shopperName'])safe[key]=safeText(safe[key]);return safe;}),
    products:input.products.map(p=>({...pick(p,['id','merchantId','name','subtitle','categoryId','originalPriceCents','originalSpecs','canSplit','requiresColdChain','stock','salesCount','tags','bannerBadge','iconType','accentColor','active','inventoryUnits','inventoryScale','inventoryNeedsReview']),options:p.options.map(o=>pick(o,optionFields))})),
    groups:input.groups.map(publicGroup),
  };
}
