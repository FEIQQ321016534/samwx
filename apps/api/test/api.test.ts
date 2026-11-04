import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { calculatePricing } from '../../../packages/domain/src/index.ts';
import { grantRole } from '../src/roles.ts';
import type { Batch, Order, Product, SplitGroup } from '../../../packages/domain/src/index.ts';

const baseline={merchantId:'merchant-laochen',communityId:'community-yangguang',batchId:'batch-laochen-demo',fulfillment:'pickup',recipientName:'测试拼友',recipientPhone:'13812345678',notes:'测试单'};
async function setup(){const ctx=await createApp({databasePath:':memory:',environment:'test',devAuthEnabled:true,devPaymentsEnabled:true});await ctx.app.ready();return ctx;}
async function call(ctx:Awaited<ReturnType<typeof setup>>,method:'GET'|'POST'|'PATCH',url:string,token?:string,body?:unknown){const r=await ctx.app.inject({method,url:`/api${url}`,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{payload:JSON.stringify(body)})});return{status:r.statusCode,...r.json()};}
async function login(ctx:Awaited<ReturnType<typeof setup>>,role='customer',extra:Record<string,unknown>={}){const r=await call(ctx,'POST','/auth/dev-login',undefined,{role,...extra});assert.equal(r.status,200);return r.data.token as string;}
async function create(ctx:Awaited<ReturnType<typeof setup>>,token:string,items:unknown[],extra:Record<string,unknown>={}){const r=await call(ctx,'POST','/orders',token,{...baseline,items,...extra});assert.equal(r.status,200,JSON.stringify(r));return r.data as Order;}

test('fees use integer cents with exact thresholds and minimum/cap',()=>{
  assert.deepEqual(calculatePricing(5400,true,'pickup'),{subtotalCents:5400,proxyFeeCents:400,packagingFeeCents:300,deliveryFeeCents:0,discountCents:0,totalCents:6100});
  assert.equal(calculatePricing(19899,true,'delivery').packagingFeeCents,300);
  assert.equal(calculatePricing(19900,true,'delivery').packagingFeeCents,0);
  assert.equal(calculatePricing(29899,false,'delivery').deliveryFeeCents,800);
  assert.equal(calculatePricing(29900,false,'delivery').deliveryFeeCents,0);
  assert.equal(calculatePricing(100000,false,'pickup').proxyFeeCents,2500);
  assert.equal(calculatePricing(10490,false,'pickup').proxyFeeCents,630);
  assert.equal(calculatePricing(0,true,'delivery').totalCents,0);
  assert.throws(()=>calculatePricing(1.5,false,'pickup'));
});

test('catalog, immutable backend pricing, automatic groups and three-person option identity',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const token=await login(ctx);
  const groupInput={productId:'sam-p2',optionId:'split-third',batchId:baseline.batchId,communityId:baseline.communityId,note:'分袋包装，尽量挑当天新鲜批次'};
  assert.equal((await call(ctx,'POST','/groups',token,{...groupInput,note:'字'.repeat(201)})).status,400);
  const g=await call(ctx,'POST','/groups',token,groupInput);assert.equal(g.data.paidSlots,0);assert.equal(g.data.note,groupInput.note);assert.equal(g.data.totalSlots,3);assert.equal(g.data.pricePerSlotCents,1350);
  const order=await create(ctx,token,[{productId:'sam-p2',optionId:'split-third',quantity:1,groupId:g.data.id,unitPriceCents:1}]);
  assert.equal(order.items[0].unitPriceCents,1350);assert.match(order.items[0].optionName,/8个/);
  const pay=await call(ctx,'POST',`/orders/${order.id}/pay`,token,{method:'dev'});assert.equal(pay.status,200);
  const catalog=await call(ctx,'GET','/catalog');const group=catalog.data.groups.find((x:SplitGroup)=>x.id===g.data.id);assert.equal(group.paidSlots,1);
  const auto=await create(ctx,token,[{productId:'sam-p1',optionId:'split-half',quantity:1}]);assert.ok(auto.items[0].groupId);
});

test('group last slot is atomic: one concurrent payer succeeds, duplicate pay does not debit/occupy twice',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const a=await login(ctx,'customer',{customerKey:'a'}),b=await login(ctx,'customer',{customerKey:'b'}),c=await login(ctx,'customer',{customerKey:'c'});
  const group=await call(ctx,'POST','/groups',a,{productId:'sam-p1',optionId:'split-half',batchId:baseline.batchId,communityId:baseline.communityId});
  const items=[{productId:'sam-p1',optionId:'split-half',quantity:1,groupId:group.data.id}];
  const oa=await create(ctx,a,items);const ob=await create(ctx,b,items);const oc=await create(ctx,c,items);
  assert.equal((await call(ctx,'POST',`/orders/${oa.id}/pay`,a,{method:'dev'})).status,200);
  const competing=await Promise.all([call(ctx,'POST',`/orders/${ob.id}/pay`,b,{method:'dev'}),call(ctx,'POST',`/orders/${oc.id}/pay`,c,{method:'dev'})]);
  assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
  await call(ctx,'POST',`/orders/${oa.id}/pay`,a,{method:'dev'});
  const g=ctx.store.require<SplitGroup>('group',group.data.id);assert.equal(g.paidSlots,2);assert.equal(g.participants.length,2);
  assert.equal(ctx.store.require<Product>('product','sam-p1').stock,48);
});

test('wallet credits/debits are idempotent and insufficient funds roll back inventory and group slots',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const token=await login(ctx);const order=await create(ctx,token,[{productId:'sam-p1',optionId:'split-half',quantity:1}]);
  const fail=await call(ctx,'POST',`/orders/${order.id}/pay`,token,{method:'wallet'});assert.equal(fail.status,409);assert.equal(ctx.store.require<SplitGroup>('group',order.items[0].groupId!).paidSlots,0);assert.equal(ctx.store.require<Product>('product','sam-p1').stock,50);
  for(let i=0;i<2;i++)assert.equal((await call(ctx,'POST','/wallet/dev-credit',token,{amountCents:10000,requestId:'credit-1'})).data.balanceCents,10000);
  assert.equal((await call(ctx,'POST','/wallet/dev-credit',token,{amountCents:10001,requestId:'credit-1'})).status,409);
  for(let i=0;i<2;i++)assert.equal((await call(ctx,'POST',`/orders/${order.id}/pay`,token,{method:'wallet'})).status,200);
  const wallet=await call(ctx,'GET','/wallet',token);assert.equal(wallet.data.balanceCents,10000-order.pricing.totalCents);assert.equal(wallet.data.entries.length,2);
});

test('unfilled group cutoff refunds full payable once, while mixed orders retain only active charges',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const token=await login(ctx);const admin=await login(ctx,'admin');
  const o=await create(ctx,token,[{productId:'sam-p1',optionId:'split-half',quantity:1}]);await call(ctx,'POST',`/orders/${o.id}/pay`,token,{method:'dev'});
  const o2=await create(ctx,token,[{productId:'sam-p2',optionId:'split-third',quantity:1},{productId:'sam-p3',optionId:'whole',quantity:1}]);await call(ctx,'POST',`/orders/${o2.id}/pay`,token,{method:'dev'});
  const close=await call(ctx,'POST',`/admin/batches/${baseline.batchId}/close`,admin,{});assert.equal(close.status,200);assert.equal(close.data.refundedOrders,2);
  const expected=o.pricing.totalCents+(o2.pricing.totalCents-calculatePricing(3980,false,'pickup').totalCents);
  assert.equal((await call(ctx,'GET','/wallet',token)).data.balanceCents,expected);
  const again=await call(ctx,'POST',`/admin/batches/${baseline.batchId}/close`,admin,{});assert.equal(again.data.refundCents,0);assert.equal((await call(ctx,'GET','/wallet',token)).data.entries.length,2);
  assert.equal((await call(ctx,'GET',`/orders/${o.id}`,token)).data.status,'refunded');assert.equal((await call(ctx,'GET',`/orders/${o2.id}`,token)).data.items[0].state,'refunded');
});

test('weight refund is idempotent; extra money becomes explicit payable, never automatic wallet deduction',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const token=await login(ctx);const merchant=await login(ctx,'merchant',{merchantId:baseline.merchantId});
  const o=await create(ctx,token,[{productId:'sam-p4',optionId:'whole',quantity:1}]);await call(ctx,'POST',`/orders/${o.id}/pay`,token,{method:'dev'});
  const refundBody={adjustmentId:'weigh-1',actualGoodsCents:16000,note:'实际称重少于预估'};
  const adjusted=await call(ctx,'POST',`/admin/orders/${o.id}/weight-adjustment`,merchant,refundBody);assert.equal(adjusted.status,200);assert.equal(adjusted.data.refundedCents,o.pricing.totalCents-calculatePricing(16000,true,'pickup').totalCents);
  await call(ctx,'POST',`/admin/orders/${o.id}/weight-adjustment`,merchant,refundBody);const before=await call(ctx,'GET','/wallet',token);assert.equal(before.data.entries.length,1);
  const higher=await call(ctx,'POST',`/admin/orders/${o.id}/weight-adjustment`,merchant,{adjustmentId:'weigh-2',actualGoodsCents:18000,note:'复核称重修正'});assert.equal(higher.data.status,'awaiting_topup');assert.ok(higher.data.topupCents>0);assert.equal((await call(ctx,'GET','/wallet',token)).data.balanceCents,before.data.balanceCents);
  assert.equal((await call(ctx,'POST',`/admin/orders/${o.id}/progress`,merchant,{status:'purchasing'})).status,409);
  const paid=await call(ctx,'POST',`/orders/${o.id}/topup`,token,{method:'dev'});assert.equal(paid.data.topupCents,0);assert.equal(paid.data.status,'paid');
});

test('merchant/customer isolation, transition and pickup checks',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const customer=await login(ctx);const other=await login(ctx,'customer',{customerKey:'other'});const merchant=await login(ctx,'merchant',{merchantId:baseline.merchantId});const foreign=await login(ctx,'merchant',{merchantId:'merchant-xiaolin'});
  const o=await create(ctx,customer,[{productId:'sam-p3',optionId:'whole',quantity:1}]);await call(ctx,'POST',`/orders/${o.id}/pay`,customer,{method:'dev'});
  assert.equal((await call(ctx,'GET',`/orders/${o.id}`,other)).status,403);assert.equal((await call(ctx,'POST',`/admin/orders/${o.id}/progress`,foreign,{status:'purchasing'})).status,403);
  assert.equal((await call(ctx,'POST','/admin/merchants/merchant-laochen/review',merchant,{status:'rejected'})).status,403);
  assert.equal((await call(ctx,'GET','/admin/wallet?customerId=dev-customer-demo',merchant)).status,403);
  const list=await call(ctx,'GET','/admin/products',foreign);assert.ok(list.data.every((p:Product)=>p.merchantId==='merchant-xiaolin'));
  assert.equal((await call(ctx,'POST',`/admin/orders/${o.id}/progress`,merchant,{status:'completed'})).status,409);
  let current=o;for(const status of ['purchasing','portioning','ready_for_pickup']){const p=await call(ctx,'POST',`/admin/orders/${o.id}/progress`,merchant,{status,note:'实操进度'});assert.equal(p.status,200);current=p.data;}
  assert.equal((await call(ctx,'POST',`/admin/orders/${o.id}/verify-pickup`,merchant,{pickupCode:'WRONG'})).status,400);
  for(let i=0;i<2;i++)assert.equal((await call(ctx,'POST',`/admin/orders/${o.id}/verify-pickup`,merchant,{pickupCode:current.pickupCode})).data.status,'completed');
});

test('production disables all dev auth/payment and real payment never reports fake success',async t=>{
  const ctx=await createApp({databasePath:':memory:',environment:'production',devAuthEnabled:true,devPaymentsEnabled:true});t.after(()=>ctx.app.close());
  const config=await call(ctx,'GET','/config');assert.equal(config.data.devPaymentsEnabled,false);assert.equal(config.data.devAuthEnabled,false);assert.equal((await call(ctx,'POST','/auth/dev-login',undefined,{role:'admin'})).status,503);
  const dev=await setup();t.after(()=>dev.app.close());const token=await login(dev);const o=await create(dev,token,[{productId:'sam-p3',optionId:'whole',quantity:1}]);const r=await call(dev,'POST',`/orders/${o.id}/pay`,token,{method:'wechat'});assert.equal(r.status,503);assert.equal(r.error.code,'WECHAT_PAY_NOT_CONFIGURED');assert.equal(dev.store.require<Order>('order',o.id).paidCents,0);
});

test('orders and wallet survive reopening database; customer development identity stays stable',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sam-api-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const databasePath=join(dir,'test.sqlite');
  const first=await createApp({databasePath,environment:'test',devAuthEnabled:true,devPaymentsEnabled:true});let token=await login(first);await call(first,'POST','/wallet/dev-credit',token,{amountCents:5000,requestId:'persist'});const o=await create(first,token,[{productId:'sam-p3',optionId:'whole',quantity:1}]);await first.app.close();
  const next=await createApp({databasePath,environment:'test',devAuthEnabled:true,devPaymentsEnabled:true});t.after(()=>next.app.close());token=await login(next);assert.equal((await call(next,'GET','/wallet',token)).data.balanceCents,5000);assert.equal((await call(next,'GET',`/orders/${o.id}`,token)).data.customerId,'dev-customer-demo');
});

test('expired batches automatically refund on service readiness and interval, without operator action',async t=>{
  const ctx=await createApp({databasePath:':memory:',environment:'test',devAuthEnabled:true,devPaymentsEnabled:true,autoCloseIntervalMs:15});t.after(()=>ctx.app.close());
  const customer=await login(ctx);const o=await create(ctx,customer,[{productId:'sam-p1',optionId:'split-half',quantity:1}]);await call(ctx,'POST',`/orders/${o.id}/pay`,customer,{method:'dev'});
  const batch=ctx.store.require<Batch>('batch',baseline.batchId);batch.cutoffAt=new Date(Date.now()-1000).toISOString();ctx.store.put('batch',batch);
  await new Promise(resolve=>setTimeout(resolve,60));
  assert.ok(ctx.store.require<Batch>('batch',batch.id).closedAt);assert.equal(ctx.store.require<Order>('order',o.id).status,'refunded');assert.equal((await call(ctx,'GET','/wallet',customer)).data.balanceCents,o.pricing.totalCents);
  await new Promise(resolve=>setTimeout(resolve,35));assert.equal((await call(ctx,'GET','/wallet',customer)).data.entries.length,1);
  const dir=mkdtempSync(join(tmpdir(),'sam-expired-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const databasePath=join(dir,'expired.sqlite');const before=await createApp({databasePath,environment:'test',devAuthEnabled:true,devPaymentsEnabled:true});const token=await login(before);const pending=await create(before,token,[{productId:'sam-p2',optionId:'split-third',quantity:1}]);await call(before,'POST',`/orders/${pending.id}/pay`,token,{method:'dev'});const expired=before.store.require<Batch>('batch',baseline.batchId);expired.cutoffAt='2020-01-01T00:00:00Z';before.store.put('batch',expired);await before.app.close();
  const after=await createApp({databasePath,environment:'test',devAuthEnabled:true,devPaymentsEnabled:true,autoCloseIntervalMs:0});t.after(()=>after.app.close());await after.app.ready();assert.equal(after.store.require<Order>('order',pending.id).status,'refunded');
});

test('browser PATCH preflight is allowed; cross-merchant creation and batch-close bypass are blocked',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const merchant=await login(ctx,'merchant',{merchantId:baseline.merchantId});
  const preflight=await ctx.app.inject({method:'OPTIONS',url:'/api/admin/products/sample',headers:{origin:'http://127.0.0.1:5173','access-control-request-method':'PATCH'}});assert.equal(preflight.statusCode,204);assert.match(preflight.headers['access-control-allow-methods'] as string,/PATCH/);
  const stolen=await call(ctx,'POST','/admin/communities',merchant,{merchantId:'merchant-xiaolin',name:'恶意社区',station:'站点',address:'地址'});assert.equal(stolen.status,403);
  assert.equal((await call(ctx,'PATCH',`/admin/batches/${baseline.batchId}`,merchant,{status:'purchasing'})).error.code,'CLOSE_BATCH_FIRST');
});

test('server-only closedAt cannot be forged to bypass failed-group refunds or cleared to reopen',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const token=await login(ctx);const merchant=await login(ctx,'merchant',{merchantId:baseline.merchantId});const o=await create(ctx,token,[{productId:'sam-p1',optionId:'split-half',quantity:1}]);await call(ctx,'POST',`/orders/${o.id}/pay`,token,{method:'dev'});
  for(const value of [new Date().toISOString(),null,''])assert.equal((await call(ctx,'PATCH',`/admin/batches/${baseline.batchId}`,merchant,{closedAt:value})).error.code,'SERVER_MANAGED_FIELD');
  assert.equal(ctx.store.require<Batch>('batch',baseline.batchId).closedAt,undefined);const closed=await call(ctx,'POST',`/admin/batches/${baseline.batchId}/close`,merchant,{});assert.equal(closed.data.refundCents,o.pricing.totalCents);
  assert.equal((await call(ctx,'PATCH',`/admin/batches/${baseline.batchId}`,merchant,{closedAt:null,status:'open'})).status,400);assert.equal((await call(ctx,'PATCH',`/admin/batches/${baseline.batchId}`,merchant,{status:'open'})).status,409);
});

test('production refuses development databases and rejects a development-origin session on every request',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'sam-production-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const databasePath=join(dir,'dev.sqlite');const dev=await createApp({databasePath,environment:'test',devAuthEnabled:true,devPaymentsEnabled:true});const token=await login(dev,'admin');await dev.app.close();
  await assert.rejects(()=>createApp({databasePath,environment:'production'}),/PRODUCTION_DEMO_DATABASE_FORBIDDEN/);
  await assert.rejects(()=>createApp({databasePath:':memory:',environment:'production',seed:true}),/PRODUCTION_DEMO_DATABASE_FORBIDDEN/);
  const production=await createApp({databasePath:':memory:',environment:'production'});t.after(()=>production.app.close());production.store.put('user',{id:'dev-admin',nickname:'禁止复用测试管理员',role:'admin'});production.store.db.prepare('INSERT INTO sessions(token,user_id,expires_at,auth_source) VALUES(?,?,?,?)').run(token,'dev-admin',Date.now()+3600_000,'development');
  assert.equal((await call(production,'GET','/me',token)).status,401);assert.equal((await call(production,'GET','/admin/overview',token)).status,401);
});

test('WeChat code exchange persists an opaque customer identity; never exposes or stores session_key',async t=>{
  const previousAppId=process.env.WECHAT_APP_ID,previousSecret=process.env.WECHAT_APP_SECRET;
  t.after(()=>{if(previousAppId===undefined)delete process.env.WECHAT_APP_ID;else process.env.WECHAT_APP_ID=previousAppId;if(previousSecret===undefined)delete process.env.WECHAT_APP_SECRET;else process.env.WECHAT_APP_SECRET=previousSecret;});
  delete process.env.WECHAT_APP_ID;delete process.env.WECHAT_APP_SECRET;
  const ctx=await createApp({databasePath:':memory:',environment:'production',wechatFetch:async(input,init)=>{const url=new URL(String(input));assert.equal(url.origin,'https://api.weixin.qq.com');assert.equal(url.pathname,'/sns/jscode2session');assert.equal(url.searchParams.get('appid'),'wx-test-app');assert.equal(url.searchParams.get('secret'),'server-secret');assert.equal(url.searchParams.get('grant_type'),'authorization_code');assert.equal(init?.redirect,'error');return Response.json(url.searchParams.get('js_code')==='bad-code'?{errcode:40029,errmsg:'invalid code'}:{openid:'openid-only-on-server',session_key:'do-not-store-this-secret',unionid:'unused-private-unionid'});}});t.after(()=>ctx.app.close());
  assert.equal((await call(ctx,'POST','/auth/wechat',undefined,{code:'test-code'})).error.code,'AUTH_NOT_CONFIGURED');process.env.WECHAT_APP_ID='wx-test-app';process.env.WECHAT_APP_SECRET='server-secret';assert.equal((await call(ctx,'GET','/config')).data.wechatLoginConfigured,true);
  const first=await call(ctx,'POST','/auth/wechat',undefined,{code:'fresh-code'});assert.equal(first.status,200);assert.equal(first.data.user.role,'customer');assert.match(first.data.user.id,/^wechat-/);assert.doesNotMatch(JSON.stringify(first),/openid-only|session_key|server-secret|do-not-store/);
  const second=await call(ctx,'POST','/auth/wechat',undefined,{code:'another-code'});assert.equal(second.data.user.id,first.data.user.id);assert.equal((await call(ctx,'GET','/me',first.data.token)).data.id,first.data.user.id);assert.equal((await call(ctx,'GET','/admin/overview',first.data.token)).status,403);assert.doesNotMatch(JSON.stringify(ctx.store.all('wechat_identity')),/session_key|do-not-store/);
  const bad=await call(ctx,'POST','/auth/wechat',undefined,{code:'bad-code'});assert.equal(bad.status,401);assert.equal(bad.error.code,'LOGIN_CODE_INVALID');
});

test('involuntary partial group failure keeps earned free shipping instead of demanding extra payment',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());const token=await login(ctx);const admin=await login(ctx,'admin');
  const whole=ctx.store.require<Product>('product','sam-p3');whole.originalPriceCents=29500;whole.options[0].priceCents=29500;ctx.store.put('product',whole);
  const split=ctx.store.require<Product>('product','sam-p2');split.options.find(o=>o.id==='split-third')!.priceCents=500;ctx.store.put('product',split);
  const order=await create(ctx,token,[{productId:'sam-p3',optionId:'whole',quantity:1},{productId:'sam-p2',optionId:'split-third',quantity:1}],{fulfillment:'delivery',address:'烟台市测试社区1号楼'});assert.equal(order.pricing.subtotalCents,30000);assert.equal(order.pricing.deliveryFeeCents,0);await call(ctx,'POST',`/orders/${order.id}/pay`,token,{method:'dev'});
  await call(ctx,'POST',`/admin/batches/${baseline.batchId}/close`,admin,{});const final=(await call(ctx,'GET',`/orders/${order.id}`,token)).data;assert.equal(final.finalPricing.deliveryFeeCents,0);assert.equal(final.topupCents,0);assert.equal(final.refundedCents,530);
});

test('local role grant requires an existing WeChat identity and approved merchant; revokes old sessions',async t=>{
  const ctx=await setup();t.after(()=>ctx.app.close());await login(ctx);assert.throws(()=>grantRole(ctx.store,{userId:'dev-customer-demo',role:'admin'}),/真实微信登录/);
  const user={id:'wechat-local-role-test',nickname:'已核验微信用户',role:'customer' as const};ctx.store.put('user',user);ctx.store.put('wechat_identity',{id:'wechat-local-role-test-identity',userId:user.id,openid:'server-only'});const oldRoleToken=ctx.store.issueSession(user.id,{source:'wechat',environment:'test'}).token;
  assert.equal((await call(ctx,'GET','/me',oldRoleToken)).status,200);
  assert.throws(()=>grantRole(ctx.store,{userId:user.id,role:'merchant'}),/merchantId/);const pending={...ctx.store.require<import('../../../packages/domain/src/index.ts').Merchant>('merchant',baseline.merchantId),id:'merchant-pending-test',status:'pending' as const};ctx.store.put('merchant',pending);assert.throws(()=>grantRole(ctx.store,{userId:user.id,role:'merchant',merchantId:pending.id}),/审核通过/);
  const granted=grantRole(ctx.store,{userId:user.id,role:'merchant',merchantId:baseline.merchantId});assert.equal(granted.user.merchantId,baseline.merchantId);assert.equal((await call(ctx,'GET','/me',oldRoleToken)).status,401);assert.equal(ctx.store.db.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').get(user.id)?.n,0);assert.throws(()=>ctx.store.issueSession(user.id,{source:'wechat',environment:'test'}),/微信身份仅用于顾客/);assert.equal(ctx.store.all('role_grant').length,1);
  assert.equal(grantRole(ctx.store,{userId:user.id,role:'customer'}).user.merchantId,undefined);assert.throws(()=>grantRole(ctx.store,{userId:'unknown',role:'admin'}),/不存在/);
});
