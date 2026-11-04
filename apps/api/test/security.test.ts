import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { createApp } from '../src/app.ts';
import { Store, sessionDigest } from '../src/db.ts';
import { createManagementAccount, hashPassword, resetManagementPassword, resolveRuntimeSecurity, resolveTrustedProxyCidrs, registerSecurity, securityLoggerOptions, setManagementAccountState, verifyPassword } from '../src/security.ts';
import type { Merchant, SplitGroup } from '../../../packages/domain/src/index.ts';

const PASSWORD='测试管理员 long passphrase 839!';
const NEW_PASSWORD='第二个安全 long passphrase 951!';
const merchant:Merchant={id:'merchant-security',name:'测试代购商',city:'烟台',status:'approved',contactName:'真实联系人',contactPhone:'13898765432',description:'社区采购',createdAt:new Date().toISOString()};
async function setup(){const context=await createApp({databasePath:':memory:',environment:'production',autoCloseIntervalMs:0});await context.app.ready();return context;}
type Context=Awaited<ReturnType<typeof setup>>;
async function call(ctx:Context,method:'GET'|'POST',url:string,token?:string,body?:unknown){const response=await ctx.app.inject({method,url:'/api'+url,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{payload:JSON.stringify(body)}:{})});return{status:response.statusCode,headers:response.headers,...response.json()};}
async function login(ctx:Context,username:string,password=PASSWORD,extra:Record<string,unknown>={}){return call(ctx,'POST','/auth/management/login',undefined,{username,password,...extra});}

test('management password KDF uses individual salts, rejects weak secrets, and never stores plaintext',async()=>{
  await assert.rejects(()=>hashPassword('too-short'),/15至256/);
  const first=await hashPassword(PASSWORD),second=await hashPassword(PASSWORD);
  assert.match(first,/^scrypt\$131072\$8\$1\$/);assert.notEqual(first,second);
  assert.equal(await verifyPassword(PASSWORD,first),true);assert.equal(await verifyPassword('incorrect password',first),false);
  assert.equal(await verifyPassword(PASSWORD,'corrupt-hash'),false);assert.doesNotMatch(first,/long passphrase/);
});

test('production management login works without AppID, ignores claimed role, and logout revokes hashed sessions',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());assert.equal(ctx.store.db.prepare('SELECT count(*) AS n FROM management_accounts').get()?.n,0);
  ctx.store.put('merchant',merchant);
  const account=await createManagementAccount(ctx.store,{username:'operator.one',password:PASSWORD,role:'merchant',merchantId:merchant.id});
  const logged=await login(ctx,'OPERATOR.ONE',PASSWORD,{role:'admin',merchantId:'another-merchant'});
  assert.equal(logged.status,200);assert.equal(logged.data.user.role,'merchant');assert.equal(logged.data.user.merchantId,merchant.id);
  assert.equal((await call(ctx,'GET','/me',logged.data.token)).data.id,account.user.id);
  assert.equal((await call(ctx,'GET','/admin/wallet?customerId=anything',logged.data.token)).status,403);
  const sessions=ctx.store.db.prepare('SELECT token,auth_source FROM sessions').all();
  assert.equal(sessions.length,1);assert.equal(sessions[0].token,sessionDigest(logged.data.token));assert.equal(sessions[0].auth_source,'management');
  assert.equal(JSON.stringify(sessions).includes(logged.data.token),false);
  const stored=ctx.store.managementAccount('operator.one')!;assert.notEqual(stored.password_hash,PASSWORD);assert.match(stored.password_hash,/^scrypt\$/);
  assert.equal((await call(ctx,'POST','/auth/logout',logged.data.token,{})).status,200);
  assert.equal((await call(ctx,'GET','/me',logged.data.token)).status,401);
  const relogged=await login(ctx,'operator.one');assert.equal(relogged.status,200);assert.notEqual(relogged.data.token,logged.data.token);
});

test('account lockout survives requests, uses generic errors, and local unlock revokes previous sessions',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());await createManagementAccount(ctx.store,{username:'admin.lock',password:PASSWORD,role:'admin'});
  const existing=await login(ctx,'admin.lock');assert.equal(existing.status,200);
  const unknown=await login(ctx,'not-an-account','incorrect passphrase');
  for(let i=0;i<5;i++){const denied=await login(ctx,'admin.lock','incorrect passphrase');assert.equal(denied.status,401);assert.equal(denied.error.message,unknown.error.message);}
  assert.ok(ctx.store.managementAccount('admin.lock')!.locked_until>Date.now());
  assert.equal((await login(ctx,'admin.lock')).status,401);assert.equal((await call(ctx,'GET','/me',existing.data.token)).status,401);
  setManagementAccountState(ctx.store,'admin.lock','unlock');
  assert.equal((await login(ctx,'admin.lock')).status,200);assert.equal((await call(ctx,'GET','/me',existing.data.token)).status,401);
});

test('disable, reset, user role changes and merchant suspension revoke authority without token revival',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());ctx.store.put('merchant',merchant);
  const account=await createManagementAccount(ctx.store,{username:'merchant.ops',password:PASSWORD,role:'merchant',merchantId:merchant.id});
  const first=await login(ctx,'merchant.ops');setManagementAccountState(ctx.store,'merchant.ops','disable');
  assert.equal((await call(ctx,'GET','/me',first.data.token)).status,401);assert.equal((await login(ctx,'merchant.ops')).status,401);
  setManagementAccountState(ctx.store,'merchant.ops','enable');const second=await login(ctx,'merchant.ops');assert.equal(second.status,200);
  await resetManagementPassword(ctx.store,'merchant.ops',NEW_PASSWORD);
  assert.equal((await login(ctx,'merchant.ops')).status,401);assert.equal((await call(ctx,'GET','/me',second.data.token)).status,401);
  const third=await login(ctx,'merchant.ops',NEW_PASSWORD);assert.equal(third.status,200);
  ctx.store.put('merchant',{...merchant,status:'paused'});assert.equal((await call(ctx,'GET','/me',third.data.token)).status,401);
  ctx.store.put('merchant',merchant);assert.equal((await call(ctx,'GET','/me',third.data.token)).status,401);
  const fourth=await login(ctx,'merchant.ops',NEW_PASSWORD);assert.equal(fourth.status,200);
  ctx.store.put('user',{...account.user,role:'admin'});assert.equal((await call(ctx,'GET','/me',fourth.data.token)).status,401);
  assert.equal((await login(ctx,'merchant.ops',NEW_PASSWORD)).status,401);
});

test('WeChat and development identities cannot be used as production management accounts',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());
  const customer={id:'wechat-security-customer',nickname:'顾客',role:'customer' as const};ctx.store.put('user',customer);
  const customerToken=ctx.store.issueSession(customer.id,{source:'wechat',environment:'production'}).token;
  assert.equal((await call(ctx,'GET','/admin/overview',customerToken)).status,403);
  assert.throws(()=>ctx.store.issueSession(customer.id,{source:'management',environment:'production'}),/管理账号不可用/);
  ctx.store.put('user',{...customer,role:'admin'});assert.equal((await call(ctx,'GET','/me',customerToken)).status,401);
  assert.throws(()=>ctx.store.issueSession(customer.id,{source:'wechat',environment:'production'}),/微信身份仅用于顾客/);
  ctx.store.put('user',{id:'dev-security',nickname:'开发管理员',role:'admin'});
  assert.throws(()=>ctx.store.issueSession('dev-security',{source:'development',environment:'test'}),/登录环境与数据库不匹配/);
});

test('public catalog and groups expose no participant identifiers, contact phones, credentials or private attachments',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());ctx.store.put('merchant',merchant);
  const group:SplitGroup={id:'group-security',merchantId:merchant.id,productId:'product-security',optionId:'half',batchId:'batch-security',communityId:'community-security',productName:'测试商品',totalSlots:2,paidSlots:1,pricePerSlotCents:1000,slotDescription:'半份',status:'recruiting',cutoffAt:new Date(Date.now()+3600_000).toISOString(),participants:[{userId:'private-user-identity',orderId:'private-order-identity',nickname:'私人顾客全名',quantity:1,paidAt:new Date().toISOString()}],createdBy:'private-creator-identity',createdAt:new Date().toISOString()};
  ctx.store.put('group',group);
  ctx.store.put('batch',{id:'batch-security',merchantId:merchant.id,title:'测试班次',storeName:'门店',cutoffAt:group.cutoffAt,pickupStartAt:group.cutoffAt,pickupEndAt:group.cutoffAt,status:'open',shopperName:'采购师傅',shopperPhone:'13998765432',note:'内部备注',photoUrls:['https://private.example/photo'],receiptUrls:['https://private.example/receipt']});
  for(const route of ['/catalog','/groups']){
    const output=await call(ctx,'GET',route);assert.equal(output.status,200);const json=JSON.stringify(output.data);
    for(const value of ['private-user-identity','private-order-identity','private-creator-identity','13898765432','13998765432','真实联系人','私人顾客全名','private.example'])assert.equal(json.includes(value),false,value);
    const groups=route==='/groups'?output.data:output.data.groups;
    assert.equal(groups[0].id,group.id);assert.deepEqual(groups[0].participants,[{nickname:'私**',quantity:1}]);
  }
});

test('IP rate limit cannot be bypassed with untrusted forwarded headers and survives SQLite reopen',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());
  for(let i=0;i<30;i++){const response=await ctx.app.inject({method:'POST',url:'/api/auth/nonexistent',headers:{'x-forwarded-for':`192.0.2.${i}`},payload:{}});assert.notEqual(response.statusCode,429);}
  const limited=await ctx.app.inject({method:'POST',url:'/api/auth/nonexistent',headers:{'x-forwarded-for':'203.0.113.99'},payload:{}});
  assert.equal(limited.statusCode,429);assert.ok(Number(limited.headers['retry-after'])>0);
  const dir=mkdtempSync(join(tmpdir(),'sam-rate-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const filename=join(dir,'rate.sqlite');
  let store=new Store(filename);assert.equal(store.consumeRateLimit('ip:private-test-address',2,1000,10).allowed,true);store.close();
  store=new Store(filename);try{assert.equal(store.consumeRateLimit('ip:private-test-address',2,1000,20).allowed,true);assert.equal(store.consumeRateLimit('ip:private-test-address',2,1000,30).allowed,false);assert.equal(JSON.stringify(store.db.prepare('SELECT * FROM security_rate_limits').all()).includes('private-test-address'),false);assert.equal(store.consumeRateLimit('ip:private-test-address',2,1000,1011).allowed,true);}finally{store.close();}
});

test('runtime defaults closed and refuses misspelled modes or publicly bound development money',()=>{
  const oldMode=process.env.NODE_ENV,oldHost=process.env.HOST;
  try{
    delete process.env.NODE_ENV;delete process.env.HOST;
    assert.deepEqual(resolveRuntimeSecurity({devAuthEnabled:true,devPaymentsEnabled:true}),{environment:'production',development:false,devAuthEnabled:false,devPaymentsEnabled:false,uatMode:false});
    assert.throws(()=>resolveRuntimeSecurity({environment:'prodution',devAuthEnabled:true}),/INVALID_RUNTIME_ENVIRONMENT/);
    assert.equal(resolveRuntimeSecurity({environment:'staging',devPaymentsEnabled:true}).devPaymentsEnabled,false);
    process.env.HOST='0.0.0.0';assert.throws(()=>resolveRuntimeSecurity({environment:'development',devAuthEnabled:true}),/DEVELOPMENT_PUBLIC_BIND_FORBIDDEN/);
  }finally{if(oldMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldMode;if(oldHost===undefined)delete process.env.HOST;else process.env.HOST=oldHost;}
});

test('only an explicitly trusted proxy CIDR may supply forwarded client identity',async()=>{
  assert.equal(resolveTrustedProxyCidrs(''),false);
  for(const entry of ['true','*','0.0.0.0/0','::/0','10.0.0.0/99','proxy.example'])assert.throws(()=>resolveTrustedProxyCidrs(entry),/INVALID_TRUST_PROXY_CIDRS/);
  assert.deepEqual(resolveTrustedProxyCidrs('172.30.20.2,127.0.0.1/32'),['172.30.20.2/32','127.0.0.1/32']);
  const store=new Store(':memory:');const app=Fastify({trustProxy:resolveTrustedProxyCidrs('172.30.20.2/32')});
  registerSecurity(app,store,resolveRuntimeSecurity({environment:'production'}));app.get('/api/ip',async request=>({ip:request.ip}));
  try{
    const trusted=await app.inject({url:'/api/ip',remoteAddress:'172.30.20.2',headers:{'x-forwarded-for':'203.0.113.99,198.51.100.20'}});assert.equal(trusted.json().ip,'198.51.100.20');
    const spoofed=await app.inject({url:'/api/ip',remoteAddress:'198.51.100.30',headers:{'x-forwarded-for':'203.0.113.99'}});assert.equal(spoofed.json().ip,'198.51.100.30');
  }finally{await app.close();store.close();}
});

test('legacy database migration preserves data, hashes existing sessions and keeps their original development boundary',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sam-session-migration-'));const filename=join(dir,'legacy.sqlite');const token=randomBytes(32).toString('hex');
  try{
    const legacy=new DatabaseSync(filename);legacy.exec('CREATE TABLE entities(kind TEXT,id TEXT,payload TEXT,PRIMARY KEY(kind,id));CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);');
    legacy.prepare('INSERT INTO entities VALUES(?,?,?)').run('user','dev-legacy',JSON.stringify({id:'dev-legacy',nickname:'保留用户',role:'customer'}));
    legacy.prepare('INSERT INTO entities VALUES(?,?,?)').run('important-record','preserve',JSON.stringify({id:'preserve',value:'不可删除的既有数据'}));
    legacy.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,'dev-legacy',Date.now()+3600_000);legacy.close();
    const store=new Store(filename);try{assert.equal(store.get<{value:string}>('important-record','preserve')!.value,'不可删除的既有数据');assert.equal(store.db.prepare('SELECT token FROM sessions').get()?.token,sessionDigest(token));assert.equal(store.session(token,{environment:'test'})?.id,'dev-legacy');assert.equal(store.session(token,{environment:'production'}),undefined);}finally{store.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('wallet fails closed on a damaged chain, protects safe integers and binds idempotency to ownership',()=>{
  const store=new Store(':memory:');try{
    store.ledger('customer',1000,'initial','refund','测试','merchant-a','order-a');
    assert.equal(store.ledger('customer',1000,'initial','refund','测试','merchant-a','order-a'),false);
    assert.throws(()=>store.ledger('customer',1000,'initial','refund','测试','merchant-b','order-a'),/归属/);
    assert.throws(()=>store.ledger('customer',Number.MAX_SAFE_INTEGER,'overflow','refund','测试'),/安全整数/);
    assert.equal(store.wallet('customer').balanceCents,1000);
    store.db.prepare('UPDATE wallet_accounts SET balance_cents=999 WHERE user_id=?').run('customer');
    assert.throws(()=>store.ledger('customer',100,'must-not-write','refund','测试'),/人工核对/);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM wallet_entries').get()?.n,1);
  }finally{store.close();}
});

test('request logging and security audit strip credentials, bodies, query values and raw error details',async()=>{
  let captured='';const stream=new Writable({write(chunk,_encoding,callback){captured+=chunk.toString();callback();}});
  const app=Fastify({logger:{...securityLoggerOptions,stream}});
  app.post('/logging-test',async request=>{request.log.info({password:'hidden-password-123',token:'hidden-token-123',body:request.body},'credential fields are redacted');request.log.error(new Error('hidden-error-secret-123'));return{ok:true};});
  try{await app.inject({method:'POST',url:'/logging-test?token=hidden-query-123',headers:{authorization:'Bearer hidden-header-123'},payload:{password:'hidden-body-123'}});assert.doesNotMatch(captured,/hidden-(password|token|error-secret|query|header|body)-123/);}finally{await app.close();}
  const store=new Store(':memory:');try{store.audit('security.test',{password:'audit-password',nested:{token:'audit-token'},recipientPhone:'13812345678'});const output=JSON.stringify(store.db.prepare('SELECT * FROM security_audit').all());assert.doesNotMatch(output,/audit-password|audit-token|13812345678/);assert.match(output,/REDACTED/);}finally{store.close();}
});

test('local CLI creates no default account, keeps passwords out of argv/output and validates secret file permissions',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sam-management-cli-'));const database=join(dir,'production.sqlite'),secretFile=join(dir,'password.txt');
  const script=fileURLToPath(new URL('../scripts/manage-account.ts',import.meta.url));const cwd=resolve(fileURLToPath(new URL('..',import.meta.url)));
  const run=(args:string[])=>spawnSync(process.execPath,['--import','tsx',script,...args],{cwd,encoding:'utf8',timeout:30_000});
  try{
    writeFileSync(secretFile,PASSWORD+'\n',{mode:0o600});
    const output=run(['create','--database',database,'--username','bootstrap.admin','--role','admin','--password-file',secretFile]);
    assert.equal(output.status,0,output.stderr);assert.equal((output.stdout+output.stderr).includes(PASSWORD),false);
    const store=new Store(database);try{assert.equal(store.db.prepare('SELECT count(*) AS n FROM management_accounts').get()?.n,1);assert.match(store.managementAccount('bootstrap.admin')!.password_hash,/^scrypt\$/);}finally{store.close();}
    chmodSync(secretFile,0o644);const insecure=run(['reset','--database',database,'--username','bootstrap.admin','--password-file',secretFile]);assert.notEqual(insecure.status,0);assert.match(insecure.stderr,/0600/);
    chmodSync(secretFile,0o600);const link=join(dir,'password-link');symlinkSync(secretFile,link);assert.notEqual(run(['reset','--database',database,'--username','bootstrap.admin','--password-file',link]).status,0);
    const unsafe=run(['reset','--database',database,'--username','bootstrap.admin','--password',PASSWORD]);assert.notEqual(unsafe.status,0);assert.equal((unsafe.stdout+unsafe.stderr).includes(PASSWORD),false);
    const nonTty=run(['reset','--database',database,'--username','bootstrap.admin']);assert.notEqual(nonTty.status,0);assert.match(nonTty.stderr,/TTY/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
