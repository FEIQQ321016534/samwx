import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { randomBytes } from 'node:crypto';
import type { Batch, CheckoutInput, Community, Merchant, Order, OrderItem, OrderStatus, PaymentRecord, Product, SplitGroup, User, Wallet } from '../../../packages/domain/src/index.ts';
import { calculatePricing, INVENTORY_SCALE } from '../../../packages/domain/src/index.ts';
import { ApiError, Store, fail, now, uid } from './db.ts';
import { seed } from './seed.ts';
import { loginWithWechat, wechatCredentials } from './wechat.ts';
import { activeQuantity, assertInventoryAvailable, auditOperation, cancelOrderItems, cents, executeOnce, fingerprint, initializeOperations, inventoryProduct, optionUnits, reconcileOrder, repriceOrder, reserveInventory, snapshotOrder, updateFinancialStatus } from './operations.ts';
import { registerOperationsRoutes } from './operations-routes.ts';
import { registerMediaRoutes } from './media.ts';
import { assertUatTester, initializeUatStore, isUatTester, listUatTesterApprovals, publicCatalog, publicGroup, registerSecurity, resolveRuntimeDatabasePath, resolveRuntimeSecurity, resolveTrustedProxyCidrs, securityLoggerOptions, setUatTesterApproval } from './security.ts';

export interface AppConfig { databasePath?: string; environment?: string; devAuthEnabled?: boolean; devPaymentsEnabled?: boolean; uatMode?: boolean; seed?: boolean; logger?: boolean; allowedOrigins?: string[]; autoCloseIntervalMs?: number; wechatFetch?: typeof fetch; mediaDirectory?:string;trustProxyCidrs?:string[] }
type Body = Record<string, unknown>;
function object(value: unknown): Body { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400,'INVALID_INPUT','请求数据必须为对象'); return value as Body; }
function str(value: unknown, label: string, max = 300): string { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400,'INVALID_INPUT',`${label}不能为空且不超过${max}字`); return value.trim(); }
function optstr(value: unknown, max = 1000): string { if (value === undefined || value === null) return ''; if (typeof value !== 'string' || value.length > max) fail(400,'INVALID_INPUT','文字格式无效或超出长度'); return value.trim(); }
function int(value: unknown, label: string, min = 0, max = 100_000_000): number { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(400,'INVALID_INPUT',`${label}必须是${min}至${max}间的整数`); return value as number; }
function date(value: unknown, label: string): string { const valueStr = str(value,label); if (!Number.isFinite(Date.parse(valueStr))) fail(400,'INVALID_INPUT',`${label}日期无效`); return new Date(valueStr).toISOString(); }
function urls(value: unknown): string[] { if (value === undefined) return []; if (!Array.isArray(value) || value.length > 20) fail(400,'INVALID_INPUT','凭证最多20个URL'); return value.map(x=>{ const valueStr=str(x,'凭证URL',2048); try { const u=new URL(valueStr); if(u.protocol!=='https:') throw new Error(); } catch { fail(400,'INVALID_INPUT','凭证必须是HTTPS URL'); } return valueStr; }); }
const result = <T>(data: T) => ({data});

export async function createApp(config: AppConfig = {}) {
  const runtime = resolveRuntimeSecurity(config);
  const { environment, development, devAuthEnabled, devPaymentsEnabled, uatMode } = runtime;
  const store = new Store(resolveRuntimeDatabasePath(runtime, config.databasePath));
  try {
    if (!development && !uatMode && (config.seed === true || store.hasDemoData())) {
      throw new Error('PRODUCTION_DEMO_DATABASE_FORBIDDEN: 正式环境拒绝演示数据和开发资金账本，请使用独立的正式数据库');
    }
    initializeUatStore(store, runtime);
    if ((development || uatMode) && (config.seed ?? true)) seed(store, uatMode ? 'uat' : 'development');
    initializeOperations(store);
  } catch (error) {
    store.close();
    throw error;
  }
  const app = Fastify({logger:config.logger?securityLoggerOptions:false, bodyLimit:128*1024, requestTimeout:30_000, connectionTimeout:30_000,trustProxy:resolveTrustedProxyCidrs(config.trustProxyCidrs)});
  registerSecurity(app,store,runtime);
  const allowedOrigins = config.allowedOrigins ?? (process.env.CORS_ORIGINS?.split(',').filter(Boolean) ?? []);
  await app.register(cors,{ methods:['GET','HEAD','POST','PATCH','OPTIONS'], origin: (origin,cb)=>cb(null,!origin || allowedOrigins.includes(origin) || (development && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) });
  app.addHook('onClose',async()=>{store.close();});
  app.setErrorHandler((error,_request,reply)=>{
    if (error instanceof ApiError) return reply.code(error.statusCode).send({error:{code:error.code,message:error.message}});
    const frameworkError=error as {validation?:unknown;statusCode?:number};
    if(frameworkError.statusCode&&frameworkError.statusCode>=400&&frameworkError.statusCode<500){const status=frameworkError.statusCode;return reply.code(status).send({error:{code:status===413?'PAYLOAD_TOO_LARGE':status===429?'RATE_LIMITED':'INVALID_INPUT',message:status===413?'请求内容超过允许大小':status===429?'操作过于频繁，请稍后再试':'请求格式不正确'}});}
    app.log.error(error);
    return reply.code(500).send({error:{code:'INTERNAL_ERROR',message:'服务暂时不可用'}});
  });
  const auth = (request: FastifyRequest, roles?: User['role'][]): User => {
    const bearer = request.headers.authorization;
    if (!bearer?.startsWith('Bearer ')) fail(401,'UNAUTHORIZED','请先登录');
    const user = store.session(bearer.slice(7),{environment});
    if (!user) fail(401,'UNAUTHORIZED','登录已过期');
    if (roles && !roles.includes(user.role)) fail(403,'FORBIDDEN','当前身份无权执行此操作');
    return user;
  };
  const scope = (user: User, merchantId: string) => { if (user.role === 'merchant' && user.merchantId !== merchantId) fail(403,'FORBIDDEN','不能访问其他代购商的数据'); };
  const creationMerchant = (user: User, value: unknown) => {const merchantId=user.role==='merchant'?user.merchantId!:str(value,'商户');if(user.role==='merchant'&&value!==undefined&&value!==merchantId)fail(403,'FORBIDDEN','不能为其他代购商创建资源');scope(user,merchantId);store.require<Merchant>('merchant',merchantId);return merchantId;};
  const manage = (request: FastifyRequest) => auth(request,['admin','merchant']);
  const scoped = <T extends {merchantId: string}>(kind: string,user: User) => store.all<T>(kind).filter(v=>user.role === 'admin' || v.merchantId === user.merchantId);
  const orderFor = (user: User,id: string): Order => { const o=store.require<Order>('order',id); if(user.role==='customer'&&o.customerId!==user.id)fail(403,'FORBIDDEN','不能访问他人的订单'); if(user.role==='merchant')scope(user,o.merchantId); return snapshotOrder(store,o); };
  registerMediaRoutes(app,store,{authenticate:auth,directory:config.mediaDirectory});
  app.addHook('preHandler',async(request,reply)=>{
    if(request.method!=='POST')return;
    const path=request.url.split('?')[0];
    const policy=path==='/api/groups'?{limit:10,window:60_000}:path==='/api/orders'?{limit:30,window:60_000}:path==='/api/merchants/apply'?{limit:3,window:86400_000}:undefined;
    if(!policy)return;
    const user=auth(request);
    const rate=store.consumeRateLimit(`create:${user.id}:${path}`,policy.limit,policy.window);
    if(!rate.allowed){reply.header('Retry-After',String(rate.retryAfterSeconds));fail(429,'CREATION_RATE_LIMIT','操作过于频繁，请稍后重试');}
  });

  registerOperationsRoutes(app,store,{auth,manage,scope,orderFor,isTest:uatMode});
  const batchFor = (user: User,id: string) => { const b=store.require<Batch>('batch',id); scope(user,b.merchantId); return b; };
  const approved = (id: string) => { const m=store.require<Merchant>('merchant',id); if(m.status!=='approved')fail(409,'MERCHANT_UNAVAILABLE','商户尚未通过审核'); return m; };
  const openBatch = (id: string,merchantId: string) => { const b=store.require<Batch>('batch',id); if(b.merchantId!==merchantId)fail(400,'BATCH_MISMATCH','批次不属于所选商户'); if(b.status!=='open'||b.closedAt||Date.parse(b.cutoffAt)<=Date.now())fail(409,'BATCH_CLOSED','本批次已截止'); return b; };
  const parseCheckout = (value: unknown, contact: boolean): CheckoutInput => {
    const b=object(value); const merchantId=str(b.merchantId,'商户'); approved(merchantId);
    const communityId=str(b.communityId,'社区'); const community=store.require<Community>('community',communityId); if(community.merchantId!==merchantId)fail(400,'COMMUNITY_MISMATCH','社区不属于该商户');if(community.active===false)fail(409,'COMMUNITY_UNAVAILABLE','该社区已暂停接单');
    const batchId=str(b.batchId,'批次'); openBatch(batchId,merchantId);
    if(b.fulfillment!=='pickup'&&b.fulfillment!=='delivery')fail(400,'INVALID_INPUT','请选择配送方式');
    if(!Array.isArray(b.items)||b.items.length===0||b.items.length>50)fail(400,'INVALID_INPUT','购物车须包含1至50种规格');
    const seen = new Set<string>();
    const items=b.items.map(raw=>{const item=object(raw);const productId=str(item.productId,'商品');const optionId=str(item.optionId,'规格');const groupId=item.groupId?str(item.groupId,'拼团'):undefined;const key=[productId,optionId,groupId??''].join(':');if(seen.has(key))fail(400,'DUPLICATE_ITEM','同规格同团请合并数量');seen.add(key);return{productId,optionId,quantity:int(item.quantity,'数量',1,100),...(groupId?{groupId}:{})};});
    const recipientName = contact?str(b.recipientName,'收货人',50):optstr(b.recipientName,50);
    const recipientPhone = contact?str(b.recipientPhone,'联系电话',20):optstr(b.recipientPhone,20);
    if(contact&&!/^1[3-9]\d{9}$/.test(recipientPhone))fail(400,'INVALID_PHONE','请输入有效的大陆手机号码');
    const address=optstr(b.address,300); if(contact&&b.fulfillment==='delivery'&&!address)fail(400,'INVALID_ADDRESS','请填写送货地址');
    return {merchantId,communityId,batchId,fulfillment:b.fulfillment,items,recipientName,recipientPhone,address,notes:optstr(b.notes),...(b.requestId?{requestId:str(b.requestId,'requestId',120)}:{})};
  };
  const quote = (input: CheckoutInput): {items: OrderItem[];pricing: ReturnType<typeof calculatePricing>} => {
    const items=input.items.map((item,index)=>{
      const p=store.require<Product>('product',item.productId); if(p.merchantId!==input.merchantId||!p.active)fail(409,'PRODUCT_UNAVAILABLE','商品不可售');
      let o=p.options.find(x=>x.id===item.optionId);
      if(item.groupId){const g=store.require<SplitGroup>('group',item.groupId);if(g.merchantId!==input.merchantId||g.batchId!==input.batchId||g.communityId!==input.communityId||g.productId!==p.id||g.optionId!==item.optionId)fail(400,'GROUP_MISMATCH','拼团与商品规格、社区或批次不一致');if(g.status!=='recruiting'||g.paidSlots+item.quantity>g.totalSlots||Date.parse(g.cutoffAt)<=Date.now())fail(409,'GROUP_FULL','该拼团已满或不可参加');o=g.optionSnapshot??o;if(!o||o.slots!==g.totalSlots)fail(409,'GROUP_REVIEW_REQUIRED','旧拼团规格不完整，请重新开团');o={...o,priceCents:g.pricePerSlotCents};}
      if(!o)fail(400,'OPTION_NOT_FOUND','商品规格不存在');const unitPriceCents=cents(o.priceCents,'商品单价',1);assertInventoryAvailable(store,p,optionUnits(o)*item.quantity);
      if(o.slots>1&&item.quantity>o.slots)fail(400,'GROUP_QUANTITY_LIMIT','单个拼份规格数量不能超过一团人数，请分团下单');
      return {...item,id:`item-${index}`,name:p.name,optionName:o.name,unitPriceCents,weightEstimate:o.weightEstimate,isSplit:o.slots>1,requiresColdChain:p.requiresColdChain,state:'active' as const,optionSnapshot:{...o},productVersion:p.version??1,unitsPerQuantity:optionUnits(o),cancelledQuantity:0,settlementGoodsCents:unitPriceCents*item.quantity,inventoryReservationRecorded:false};
    });
    const subtotal=int(items.reduce((sum,x)=>sum+x.unitPriceCents*x.quantity,0),'商品总金额');
    for(const productId of new Set(items.map(i=>i.productId))){const units=items.filter(i=>i.productId===productId).reduce((sum,i)=>sum+i.unitsPerQuantity*i.quantity,0);assertInventoryAvailable(store,store.require<Product>('product',productId),units);}
    const pricing=calculatePricing(subtotal,items.some(x=>x.requiresColdChain),input.fulfillment);cents(pricing.totalCents,'订单总金额',1);return {items,pricing};
  };
  const methodAllowed = (method: unknown, user: User): PaymentRecord['method'] => {
    if (method === 'wechat') fail(503, 'WECHAT_PAY_NOT_CONFIGURED', '微信支付尚未配置，未发起扣款');
    if (method === 'dev') {
      if (!devPaymentsEnabled) fail(403, 'DEV_PAYMENT_DISABLED', '开发支付未启用');
      return 'dev';
    }
    if (method === 'test' || (method === 'wallet' && uatMode)) assertUatTester(store, user.id, runtime);
    if (method === 'test' || method === 'wallet') return method;
    fail(400, 'INVALID_PAYMENT_METHOD', '无效的支付方式');
  };
  const walletFor = (userId: string): Wallet => ({ ...store.wallet(userId), ...(uatMode ? { isTest: true as const } : {}) });
  const recordPayment = (order: Order, method: PaymentRecord['method'], kind: PaymentRecord['kind'], amountCents: number, reference: string) => {
    const ledgerKind = kind === 'initial' ? 'payment' : 'topup';
    const purpose = kind === 'initial' ? '订单支付' : '称重补款';
    if (method === 'test') {
      store.ledger(order.customerId, amountCents, `test-funding:${reference}`, 'test_funding', `模拟${purpose}入账（测试资金）`, order.merchantId, order.id);
    }
    if (method === 'test' || method === 'wallet') {
      const note = order.isTest ? `测试${purpose}（无真实资金）` : kind === 'initial' ? '订单余额支付' : '称重差价补款';
      store.ledger(order.customerId, -amountCents, reference, ledgerKind, note, order.merchantId, order.id);
    }
    order.payments!.push({ id: uid('payment'), kind, method, amountCents, reference, createdAt: now() });
  };
  const closeBatch = (batchId: string, user?: User) => store.transaction(()=>{
    const batch=user?batchFor(user,batchId):store.require<Batch>('batch',batchId);if(batch.closedAt)return{batch,failedGroups:0,refundedOrders:0,refundCents:0};
    if(batch.status==='cancelled'||batch.status==='completed')fail(409,'BATCH_NOT_OPEN','此批次不可截单');
    const groups=store.all<SplitGroup>('group').filter(g=>g.batchId===batch.id);const failedIds=new Set<string>();
    for(const g of groups){if(g.paidSlots<g.totalSlots){g.status='failed';failedIds.add(g.id);}else g.status='purchasing';store.put('group',g);}
    let refundedOrders=0,refundCents=0;
    for(const raw of store.all<Order>('order').filter(o=>o.batchId===batch.id)){const o=snapshotOrder(store,raw);
      if(!o.paidAt){if(o.status==='unpaid'){o.status='cancelled';store.put('order',o);}continue;}
      const cancelled=o.items.filter(item=>item.groupId&&failedIds.has(item.groupId)&&activeQuantity(item)>0).map(item=>({itemId:item.id!,quantity:activeQuantity(item)}));
      if(cancelled.length){cancelOrderItems(store,o,cancelled,true);const before=o.refundedCents;reconcileOrder(store,o,{reference:`batch-failure:${batch.id}:${o.id}`,requestId:`close-${batch.id}`,type:'group_failed',actorId:user?.id??'system',reason:'截止未成团，退回余额',items:cancelled});refundCents+=o.refundedCents-before;if(o.refundedCents>before)refundedOrders++;auditOperation(store,{action:'group_failed_refund',actorId:user?.id??'system',merchantId:o.merchantId,orderId:o.id,reason:'截止未成团',after:{refundCents:o.refundedCents-before,items:cancelled}});}
      if(o.status==='paid')o.status='purchasing';store.put('order',o);
    }
    batch.closedAt=now();batch.status='purchasing';store.put('batch',batch);auditOperation(store,{action:'batch_closed',actorId:user?.id??'system',merchantId:batch.merchantId,reason:'批次截单',after:{batchId:batch.id,failedGroups:failedIds.size,refundedOrders,refundCents}});return{batch,failedGroups:failedIds.size,refundedOrders,refundCents};
  });
  const scanExpiredBatches = () => {
    for(const batch of store.all<Batch>('batch'))if(batch.status==='open'&&!batch.closedAt&&Date.parse(batch.cutoffAt)<=Date.now()) {
      try { const summary=closeBatch(batch.id);app.log.info({batchId:batch.id,refundCents:summary.refundCents},'Expired batch closed'); }
      catch(error){app.log.error({err:error,batchId:batch.id},'Expired batch processing failed');}
    }
  };
  let closeTimer: ReturnType<typeof setInterval> | undefined;
  app.addHook('onReady',async()=>{scanExpiredBatches();const interval=config.autoCloseIntervalMs??30_000;if(interval>0){closeTimer=setInterval(scanExpiredBatches,interval);closeTimer.unref();}});
  app.addHook('onClose',async()=>{if(closeTimer)clearInterval(closeTimer);});

  app.get('/api/health',async()=>result({ok:true}));
  app.get('/api/config', async request => {
    const bearer = request.headers.authorization;
    const customer = uatMode && bearer?.startsWith('Bearer ')
      ? store.session(bearer.slice(7), { environment, allowedSources: ['wechat'] })
      : undefined;
    const environmentLabel = uatMode ? '线上测试环境' : environment === 'staging' ? '预发布环境' : development ? '本地开发环境' : '正式环境';
    return result({ environmentLabel, uatEnabled: uatMode, testPaymentsEnabled: Boolean(customer && isUatTester(store, customer.id, runtime)), devAuthEnabled, devPaymentsEnabled, managementAuthEnabled: true, wechatLoginConfigured: Boolean(wechatCredentials()), wechatPayConfigured: false, wechatPaymentEnabled: false, city: '烟台市', currency: 'CNY' });
  });
  app.post('/api/auth/dev-login',async request=>{
    if(!devAuthEnabled)fail(503,'AUTH_NOT_CONFIGURED','真实微信身份登录尚未配置，开发身份登录未启用');
    const b=object(request.body);if(!['admin','merchant','customer'].includes(String(b.role)))fail(400,'INVALID_ROLE','无效身份');
    const role=b.role as User['role'];const merchantId=role==='merchant'?str(b.merchantId,'代购商'):undefined;
    if(merchantId)store.require<Merchant>('merchant',merchantId);
    const customerKey=role==='customer'?(optstr(b.customerKey??b.loginKey,80)||'demo'):'';
    const id=role==='merchant'?`dev-merchant-${merchantId}`:role==='customer'?`dev-customer-${customerKey}`:'dev-admin';
    const existing=store.get<User>('user',id);
    const user=existing??{id,nickname:optstr(b.nickname,50)||(role==='admin'?'平台运营':role==='merchant'?'商户运营':'邻里拼友'),role,...(merchantId?{merchantId}:{})};store.put('user',user);
    const {token}=store.issueSession(user.id,{source:'development',environment});
    return result({token,user});
  });
  app.post('/api/auth/wechat',async request=>{const code=str(object(request.body).code,'微信登录凭证',512);const user=await loginWithWechat(store,code,config.wechatFetch);const {token}=store.issueSession(user.id,{source:'wechat',environment});return result({token,user});});
  app.post('/api/auth/logout',async request=>{const bearer=request.headers.authorization;if(bearer?.startsWith('Bearer '))store.revokeSession(bearer.slice(7));return result({ok:true});});
  app.get('/api/me',async request=>result(auth(request)));
  app.get('/api/catalog',async request=>{
    const q=(request.query??{}) as Record<string,string>; const merchants=store.all<Merchant>('merchant').filter(m=>m.status==='approved');const allowed=new Set(merchants.map(m=>m.id));
    const filter=(v:{merchantId:string})=>allowed.has(v.merchantId)&&(!q.merchantId||v.merchantId===q.merchantId);
    return result(publicCatalog({merchants,communities:store.all<Community>('community').filter(c=>filter(c)&&c.active!==false),batches:store.all<Batch>('batch').filter(filter),products:store.all<Product>('product').filter(p=>filter(p)&&p.active),groups:store.all<SplitGroup>('group').filter(g=>filter(g)&&(!q.batchId||g.batchId===q.batchId))}));
  });
  app.get('/api/groups',async request=>{const q=(request.query??{})as Record<string,string>;return result(store.all<SplitGroup>('group').filter(g=>(!q.merchantId||g.merchantId===q.merchantId)&&(!q.batchId||g.batchId===q.batchId)&&store.get<Merchant>('merchant',g.merchantId)?.status==='approved').map(publicGroup));});
  app.post('/api/groups',async request=>{
    const user=auth(request,['customer']);const b=object(request.body);const p=store.require<Product>('product',str(b.productId,'商品'));approved(p.merchantId);if(!p.active||!p.canSplit)fail(400,'NOT_SPLITTABLE','商品不支持拼份');
    const o=p.options.find(x=>x.id===b.optionId);if(!o||o.slots<2)fail(400,'INVALID_OPTION','请选择可拼的固定规格');
    const batch=openBatch(str(b.batchId,'批次'),p.merchantId);const community=store.require<Community>('community',str(b.communityId,'社区'));if(community.merchantId!==p.merchantId)fail(400,'COMMUNITY_MISMATCH','社区不属于该商户');if(community.active===false)fail(409,'COMMUNITY_UNAVAILABLE','社区已暂停接单');assertInventoryAvailable(store,p,optionUnits(o));
    const g:SplitGroup={id:uid('group'),merchantId:p.merchantId,productId:p.id,optionId:o.id,batchId:batch.id,communityId:community.id,productName:p.name,totalSlots:o.slots,paidSlots:0,pricePerSlotCents:o.priceCents,slotDescription:o.name,note:optstr(b.note,200),optionSnapshot:{...o},productVersion:p.version??1,status:'recruiting',cutoffAt:batch.cutoffAt,participants:[],createdBy:user.id,createdAt:now()};return result(publicGroup(store.put('group',g)));
  });
  app.post('/api/orders/quote',async request=>{auth(request,['customer']);const input=parseCheckout(request.body,false);return result(quote(input));});
  app.post('/api/orders',async request=>{
    const user=auth(request,['customer']);const raw=object(request.body);const header=request.headers['idempotency-key'];const requestId=raw.requestId?str(raw.requestId,'requestId',120):typeof header==='string'?str(header,'Idempotency-Key',120):'';if(raw.requestId&&header&&raw.requestId!==header)fail(400,'IDEMPOTENCY_CONFLICT','请求体与请求头幂等标识不一致');
    if(!requestId&&!development)fail(400,'IDEMPOTENCY_KEY_REQUIRED','正式环境创建订单必须提供requestId或Idempotency-Key');
    return result(store.transaction(()=>{const create=()=>{const input=parseCheckout(raw,true);quote(input);
      for(const item of input.items)if(!item.groupId){const p=store.require<Product>('product',item.productId);const option=p.options.find(o=>o.id===item.optionId)!;if(option.slots<2)continue;const existing=store.all<SplitGroup>('group').find(g=>g.productId===p.id&&g.optionId===option.id&&g.batchId===input.batchId&&g.communityId===input.communityId&&g.status==='recruiting'&&g.paidSlots+item.quantity<=g.totalSlots&&g.pricePerSlotCents===option.priceCents&&g.productVersion===p.version&&g.totalSlots===option.slots&&Date.parse(g.cutoffAt)>Date.now());
        if(existing)item.groupId=existing.id;else{const batch=store.require<Batch>('batch',input.batchId);const group:SplitGroup={id:uid('group'),merchantId:p.merchantId,productId:p.id,optionId:option.id,batchId:input.batchId,communityId:input.communityId,productName:p.name,totalSlots:option.slots,paidSlots:0,pricePerSlotCents:option.priceCents,slotDescription:option.name,optionSnapshot:{...option},productVersion:p.version??1,status:'recruiting',cutoffAt:batch.cutoffAt,participants:[],createdBy:user.id,createdAt:now()};store.put('group',group);item.groupId=group.id;}}
      const q=quote(input);const order:Order=snapshotOrder(store,{...input,...(requestId?{requestId}:{}),...(uatMode?{isTest:true as const}:{}),id:uid('order'),customerId:user.id,createdAt:now(),status:'unpaid',items:q.items,pricing:q.pricing,finalPricing:q.pricing,paidCents:0,refundedCents:0,topupCents:0,progress:[],weightAdjustments:[],photoUrls:[],receiptUrls:[]});store.put('order',order);auditOperation(store,{action:'order_created',actorId:user.id,merchantId:order.merchantId,orderId:order.id,requestId:requestId||undefined,reason:'创建订单',after:{pricing:order.pricing,isTest:order.isTest}});return order;};return requestId?executeOnce(store,user,'create-order',requestId,raw,create):create();}));
  });
  app.get('/api/orders',async request=>{const user=auth(request);return result(store.all<Order>('order').filter(o=>user.role==='admin'||(user.role==='merchant'?o.merchantId===user.merchantId:o.customerId===user.id)).reverse());});
  app.get('/api/orders/:id',async request=>result(orderFor(auth(request),(request.params as {id:string}).id)));
  app.post('/api/orders/:id/pay',async request=>{
    const user=auth(request,['customer']);const requestedMethod=object(request.body).method;const id=(request.params as {id:string}).id;
    return result(store.transaction(()=>{
      const method = methodAllowed(requestedMethod, user);
      const order=orderFor(user,id);if(order.paidAt)return order;if(order.status!=='unpaid')fail(409,'ORDER_NOT_PAYABLE','订单不可支付');openBatch(order.batchId,order.merchantId);approved(order.merchantId);if(Date.parse(order.batchSnapshot!.cutoffAt)<=Date.now())fail(409,'ORDER_DEADLINE_PASSED','订单原截单时间已到，请重新下单');if(store.require<Community>('community',order.communityId).active===false)fail(409,'COMMUNITY_UNAVAILABLE','社区已暂停接单');cents(order.pricing.totalCents,'支付金额',1);
      reserveInventory(store,order);
      for(const item of order.items)if(item.groupId){const g=store.require<SplitGroup>('group',item.groupId);if(g.productId!==item.productId||g.optionId!==item.optionId||g.batchId!==order.batchId||g.communityId!==order.communityId||g.merchantId!==order.merchantId)fail(409,'GROUP_MISMATCH','订单拼团快照异常');if(g.status!=='recruiting'||g.paidSlots+item.quantity>g.totalSlots||Date.parse(g.cutoffAt)<=Date.now())fail(409,'GROUP_FULL','团已满或已截止，请选择其他拼团');g.paidSlots+=item.quantity;g.status=g.paidSlots===g.totalSlots?'full':'recruiting';g.participants.push({userId:user.id,nickname:user.nickname,orderId:order.id,quantity:item.quantity,paidAt:now()});store.put('group',g);}
      recordPayment(order, method, 'initial', order.pricing.totalCents, `order-pay:${order.id}`);
      order.paidAt = now();
      order.status = 'paid';
      order.paymentMethod = method;
      order.paidCents = order.pricing.totalCents;
      order.pickupCode = randomBytes(8).toString('hex').toUpperCase();
      updateFinancialStatus(order);
      const note = order.isTest ? '测试支付成功（无真实资金）' : method === 'dev' ? '开发模式模拟支付成功（无真实扣款）' : '余额支付成功';
      order.progress.push({ id: uid('progress'), at: now(), status: 'paid', note, photoUrls: [], receiptUrls: [] });
      auditOperation(store, { action: 'order_paid', actorId: user.id, merchantId: order.merchantId, orderId: order.id, reason: note, after: { method, amountCents: order.paidCents, isTest: order.isTest } });
      return store.put('order', order);
    }));
  });
  app.post('/api/orders/:id/topup',async request=>{
    const user = auth(request, ['customer']);
    const requestedMethod = object(request.body).method;
    return result(store.transaction(() => {
      const method = methodAllowed(requestedMethod, user);
      const order = orderFor(user, (request.params as { id: string }).id);
      if (!order.paidAt) fail(409, 'ORDER_NOT_PAID', '请先支付订单');
      if (order.topupCents === 0) return order;
      if (order.status !== 'awaiting_topup' || ['ready_for_pickup', 'delivering', 'completed', 'refunded', 'cancelled'].includes(order.statusBeforeTopup ?? '')) {
        fail(409, 'ORDER_NOT_PAYABLE', '当前履约阶段不能补款');
      }
      const amount = cents(order.topupCents, '补款金额', 1);
      const reference = `topup:${order.id}:${order.weightAdjustments.at(-1)?.adjustmentId ?? 'close'}`;
      if (!Number.isSafeInteger(order.paidCents + amount)) fail(409, 'FINANCIAL_REVIEW_REQUIRED', '累计实收异常');
      recordPayment(order, method, 'topup', amount, reference);
      order.paidCents += amount;
      order.topupCents = 0;
      order.status = order.statusBeforeTopup ?? 'paid';
      delete order.statusBeforeTopup;
      updateFinancialStatus(order);
      const source = order.isTest ? '测试资金' : method === 'dev' ? '开发模拟' : '余额';
      order.progress.push({ id: uid('progress'), at: now(), status: order.status, note: `称重补款 ${amount} 分（${source}）`, photoUrls: [], receiptUrls: [] });
      auditOperation(store, { action: 'weight_topup_paid', actorId: user.id, merchantId: order.merchantId, orderId: order.id, reason: '用户主动补差价', after: { method, amountCents: amount, status: order.status, isTest: order.isTest } });
      return store.put('order', order);
    }));
  });
  app.post('/api/orders/:id/cancel',async request=>{const user=auth(request,['customer']);return result(store.transaction(()=>{const o=orderFor(user,(request.params as {id:string}).id);if(o.status==='cancelled')return o;if(o.status!=='unpaid')fail(409,'CANNOT_CANCEL','已支付订单请联系商户处理售后');o.status='cancelled';auditOperation(store,{action:'unpaid_order_cancelled',actorId:user.id,merchantId:o.merchantId,orderId:o.id,reason:'顾客取消未付款订单'});return store.put('order',o);}));});
  app.get('/api/wallet',async request=>result(walletFor(auth(request,['customer']).id)));
  app.post('/api/wallet/dev-credit',async request=>{const user=auth(request,['customer']);if(!devPaymentsEnabled)fail(403,'DEV_PAYMENT_DISABLED','开发余额充值未启用');const b=object(request.body);const amount=int(b.amountCents,'充值金额',1,1_000_000);const requestId=str(b.requestId,'幂等标识',100);return result(store.transaction(()=>{store.ledger(user.id,amount,`dev-credit:${requestId}`,'dev_credit','开发模拟充值；非真实资金');return store.wallet(user.id);}));});
  app.post('/api/wallet/test-credit', async request => {
    const user = auth(request, ['customer']);
    const body = object(request.body);
    const amountCents = int(body.amountCents, '测试充值金额', 1, 100_000);
    const requestId = str(body.requestId, '幂等标识', 100);
    return result(store.transaction(() => {
      assertUatTester(store, user.id, runtime);
      const credited = store.ledger(user.id, amountCents, `test-credit:${requestId}`, 'test_credit', '测试余额入账（无真实资金）');
      if (credited) auditOperation(store, { action: 'test_wallet_credit', actorId: user.id, requestId, reason: '测试余额入账（无真实资金）', after: { amountCents } });
      return walletFor(user.id);
    }));
  });

  if (uatMode) {
    app.get('/api/admin/test-users', async request => {
      const admin = auth(request, ['admin']);
      return result(listUatTesterApprovals(store, admin, runtime).map(({ approved, ...user }) => ({ ...user, enabled: approved })));
    });
    app.post('/api/admin/test-users/:id', async request => {
      const admin = auth(request, ['admin']);
      const { enabled } = object(request.body);
      if (typeof enabled !== 'boolean') fail(400, 'INVALID_INPUT', 'enabled 须为布尔值');
      const { id } = request.params as { id: string };
      const { approved, ...user } = setUatTesterApproval(store, admin, id, enabled, runtime);
      return result({ ...user, enabled: approved });
    });
  }

  app.post('/api/merchants/apply',async request=>{const user=auth(request,['customer','admin']);const b=object(request.body);const m:Merchant={id:uid('merchant'),name:str(b.name,'商户名称',80),city:'烟台',status:'pending',contactName:str(b.contactName,'联系人',50),contactPhone:str(b.contactPhone,'联系电话',20),description:optstr(b.description),createdAt:now()};if(!/^1[3-9]\d{9}$/.test(m.contactPhone))fail(400,'INVALID_PHONE','联系电话无效');store.put('merchant',m);store.put('application',{id:m.id,userId:user.id,merchantId:m.id});return result(m);});
  app.get('/api/admin/overview',async request=>{const user=manage(request);const merchants=store.all<Merchant>('merchant').filter(m=>user.role==='admin'||m.id===user.merchantId);const orders=scoped<Order>('order',user);return result({merchants:merchants.length,products:scoped<Product>('product',user).length,batches:scoped<Batch>('batch',user).length,orders:orders.length,revenueCents:orders.reduce((sum,o)=>sum+o.paidCents-o.refundedCents,0),pendingReviews:merchants.filter(m=>m.status==='pending').length,...(uatMode?{isTest:true}:{})});});
  app.get('/api/admin/merchants',async request=>{const user=manage(request);return result(store.all<Merchant>('merchant').filter(m=>user.role==='admin'||m.id===user.merchantId));});
  app.post('/api/admin/merchants/:id/review',async request=>{const user=auth(request,['admin']);const b=object(request.body);if(b.status!=='approved'&&b.status!=='rejected'&&b.status!=='paused')fail(400,'INVALID_INPUT','审核状态无效');const m=store.require<Merchant>('merchant',(request.params as {id:string}).id);if(b.status==='paused'&&m.status==='pending')fail(400,'INVALID_INPUT','待审核商户不能暂停营业');const before=m.status;m.status=b.status;m.reviewReason=b.status==='paused'?str(b.reason,'暂停营业原因',500):optstr(b.reason);return result(store.transaction(()=>{store.put('merchant',m);auditOperation(store,{action:'merchant_reviewed',actorId:user.id,merchantId:m.id,reason:m.reviewReason||'平台商户审核',before:{status:before},after:{status:m.status}});return m;}));});
  app.get('/api/admin/communities',async request=>result(scoped<Community>('community',manage(request))));
  app.post('/api/admin/communities',async request=>{const user=manage(request);const b=object(request.body);if(b.active!==undefined&&typeof b.active!=='boolean')fail(400,'INVALID_INPUT','active须为布尔值');const merchantId=creationMerchant(user,b.merchantId);return result(store.transaction(()=>{const c=store.put<Community>('community',{id:uid('community'),merchantId,name:str(b.name,'社区名',80),station:str(b.station,'站点名称',120),address:str(b.address,'自提地址',300),active:b.active!==false});auditOperation(store,{action:'community_created',actorId:user.id,merchantId,reason:'新增社区',after:c});return c;}));});
  const productData=(b:Body,merchantId:string,id:string):Product=>{
    for(const field of ['active','canSplit','requiresColdChain'])if(field in b&&typeof b[field]!=='boolean')fail(400,'INVALID_INPUT',`${field}须为布尔值`);
    if(!Array.isArray(b.options)||b.options.length===0||b.options.length>10)fail(400,'INVALID_INPUT','请配置1至10个规格');
    const seen=new Set<string>();const options=b.options.map(raw=>{const o=object(raw);const oid=str(o.id,'规格id',80);if(seen.has(oid))fail(400,'INVALID_INPUT','规格id不可重复');seen.add(oid);const slots=int(o.slots,'拼份人数',1,20);const ratio=Number(o.ratio);if(!Number.isFinite(ratio)||ratio<=0||ratio>1||Math.abs(ratio*slots-1)>0.01)fail(400,'INVALID_INPUT','份额比例须与拼份人数匹配');return{id:oid,name:str(o.name,'规格名',100),ratio,slots,weightEstimate:optstr(o.weightEstimate,100),priceCents:int(o.priceCents,'规格价格',1),description:optstr(o.description,300)};});
    const canSplit=Boolean(b.canSplit);if(!canSplit&&options.some(o=>o.slots>1))fail(400,'INVALID_INPUT','不支持拼份的商品只能配置整件规格');
    const stock=int(b.stock,'库存整包数',0,1_000_000);return{id,merchantId,name:str(b.name,'商品名',150),subtitle:optstr(b.subtitle,300),categoryId:str(b.categoryId,'分类',50),originalPriceCents:int(b.originalPriceCents,'整件价格',1),originalSpecs:str(b.originalSpecs,'整件规格',150),canSplit,requiresColdChain:Boolean(b.requiresColdChain),stock,salesCount:int(b.salesCount??0,'销量',0,10_000_000),tags:Array.isArray(b.tags)?b.tags.map(t=>str(t,'标签',30)).slice(0,10):[],iconType:optstr(b.iconType,30)||'grocery',accentColor:/^#[\da-fA-F]{6}$/.test(String(b.accentColor))?String(b.accentColor):'#0055A5',options,active:b.active!==false,inventoryUnits:typeof b.inventoryUnits==='number'?b.inventoryUnits:stock*INVENTORY_SCALE,inventoryScale:INVENTORY_SCALE,inventoryNeedsReview:Boolean(b.inventoryNeedsReview),version:typeof b.version==='number'?b.version:1,...(b.legacyStock!==undefined?{legacyStock:Number(b.legacyStock)}:{}),...(b.bannerBadge?{bannerBadge:optstr(b.bannerBadge,50)}:{})};
  };
  app.get('/api/admin/products',async request=>result(scoped<Product>('product',manage(request))));
  app.post('/api/admin/products',async request=>{const user=manage(request);const b=object(request.body);for(const f of ['inventoryUnits','inventoryScale','inventoryNeedsReview','version','legacyStock'])if(f in b)fail(400,'SERVER_MANAGED_FIELD','库存内部单位和版本由服务器维护');const merchantId=creationMerchant(user,b.merchantId);return result(store.transaction(()=>{const p=store.put('product',productData(b,merchantId,uid('product')));auditOperation(store,{action:'product_created',actorId:user.id,merchantId,reason:'新建商品',after:{id:p.id,inventoryUnits:p.inventoryUnits,options:p.options}});return p;}));});
  app.patch('/api/admin/products/:id',async request=>{const user=manage(request);return result(store.transaction(()=>{const p=inventoryProduct(store,store.require<Product>('product',(request.params as {id:string}).id));scope(user,p.merchantId);const b=object(request.body);if(b.merchantId&&b.merchantId!==p.merchantId)fail(400,'IMMUTABLE_MERCHANT','不能修改商品所属商户');for(const f of ['inventoryUnits','inventoryScale','inventoryNeedsReview','version','legacyStock'])if(f in b)fail(400,'SERVER_MANAGED_FIELD','库存内部单位和版本由服务器维护');if('stock'in b&&b.stock!==p.stock)fail(409,'INVENTORY_ADJUSTMENT_REQUIRED','已有商品库存请通过实盘接口调整并填写原因');const updated=productData({...p,...b,version:(p.version??1)+1},p.merchantId,p.id);store.put('product',updated);auditOperation(store,{action:'product_updated',actorId:user.id,merchantId:p.merchantId,reason:'商品配置更新；已有订单/拼团使用原快照',before:{version:p.version,options:p.options},after:{version:updated.version,options:updated.options}});return updated;}));});
  const batchData=(b:Body,merchantId:string,id:string):Batch=>{const cutoffAt=date(b.cutoffAt,'截单时间');const pickupStartAt=date(b.pickupStartAt,'自提开始');const pickupEndAt=date(b.pickupEndAt,'自提结束');if(Date.parse(pickupStartAt)<Date.parse(cutoffAt)||Date.parse(pickupEndAt)<=Date.parse(pickupStartAt))fail(400,'INVALID_SCHEDULE','自提时间须在截单后且结束晚于开始');if(!['open','purchasing','portioning','ready_for_pickup','completed','cancelled'].includes(String(b.status??'open')))fail(400,'INVALID_INPUT','批次状态无效');return{id,merchantId,title:str(b.title,'班次名称',120),storeName:str(b.storeName,'采购门店',120),cutoffAt,pickupStartAt,pickupEndAt,status:(b.status??'open')as Batch['status'],shopperName:optstr(b.shopperName,50),shopperPhone:optstr(b.shopperPhone,30),note:optstr(b.note),photoUrls:urls(b.photoUrls),receiptUrls:urls(b.receiptUrls),...(b.closedAt?{closedAt:str(b.closedAt,'截单记录')}: {})};};
  app.get('/api/admin/batches',async request=>result(scoped<Batch>('batch',manage(request))));
  app.post('/api/admin/batches',async request=>{const user=manage(request);const b=object(request.body);if('closedAt'in b)fail(400,'SERVER_MANAGED_FIELD','closedAt只能由系统截单写入');if(b.status&&b.status!=='open')fail(400,'BATCH_MUST_START_OPEN','新批次须从开放接单开始');const merchantId=creationMerchant(user,b.merchantId);const batch=batchData(b,merchantId,uid('batch'));if(Date.parse(batch.cutoffAt)<=Date.now())fail(400,'INVALID_SCHEDULE','新班次的截单时间须晚于当前时间');return result(store.transaction(()=>{store.put('batch',batch);auditOperation(store,{action:'batch_created',actorId:user.id,merchantId,reason:'新建采购批次',after:batch});return batch;}));});
  app.patch('/api/admin/batches/:id',async request=>{const user=manage(request);return result(store.transaction(()=>{const old=batchFor(user,(request.params as {id:string}).id);const b=object(request.body);if('closedAt'in b)fail(400,'SERVER_MANAGED_FIELD','closedAt只能由系统截单写入');if(b.merchantId&&b.merchantId!==old.merchantId)fail(400,'IMMUTABLE_MERCHANT','不能修改班次所属商户');if(b.status==='cancelled'&&old.status!=='cancelled')fail(409,'USE_BATCH_CANCEL','取消批次须使用专用取消接口以处理退款');if(old.closedAt&&b.status==='open')fail(409,'BATCH_CLOSED','已截单班次不可重开');if(!old.closedAt&&b.status&&b.status!=='open')fail(409,'CLOSE_BATCH_FIRST','请先执行截单，系统会处理未成团退款');if(b.status&&b.status!==old.status){const stages=['open','purchasing','portioning','ready_for_pickup','completed'];if(old.status==='cancelled'||stages.indexOf(String(b.status))!==stages.indexOf(old.status)+1)fail(409,'INVALID_BATCH_TRANSITION','批次状态只能按采购、分装、待提、完成顺序推进');if(b.status==='completed'&&store.all<Order>('order').some(o=>o.batchId===old.id&&o.paidAt&&!['completed','refunded','cancelled'].includes(o.status)))fail(409,'BATCH_HAS_ACTIVE_ORDERS','批次仍有未完成订单，不能标记完成');}if(b.cutoffAt&&date(b.cutoffAt,'截单时间')!==old.cutoffAt&&store.all<Order>('order').some(o=>o.batchId===old.id))fail(409,'BATCH_SCHEDULE_LOCKED','已有订单的批次不可修改截单时间；请新建班次或取消原批次');const updated=batchData({...old,...b},old.merchantId,old.id);store.put('batch',updated);auditOperation(store,{action:'batch_updated',actorId:user.id,merchantId:old.merchantId,reason:'批次配置更新',before:old,after:updated});return updated;}));});
  app.get('/api/admin/batches/:id/picking-list',async request=>{const user=manage(request);const batch=batchFor(user,(request.params as {id:string}).id);const orders=scoped<Order>('order',user).filter(o=>o.batchId===batch.id&&o.paidAt&&o.status!=='refunded');const lines=new Map<string,{productId:string;name:string;optionId:string;optionName:string;quantity:number;wholePackEquivalent:number}>();for(const o of orders)for(const i of o.items)if(activeQuantity(i)>0){const key=`${i.productId}:${i.optionId}:${i.productVersion??'legacy'}`;const line=lines.get(key)??{productId:i.productId,name:i.name,optionId:i.optionId,optionName:i.optionName,quantity:0,wholePackEquivalent:0};line.quantity+=activeQuantity(i);line.wholePackEquivalent+=(i.unitsPerQuantity??0)*activeQuantity(i)/INVENTORY_SCALE;lines.set(key,line);}return result({batch,orderCount:orders.length,items:[...lines.values()],groups:store.all<SplitGroup>('group').filter(g=>g.batchId===batch.id)});});
  app.post('/api/admin/batches/:id/close',async request=>{
    const user=manage(request);return result(closeBatch((request.params as {id:string}).id,user));
  });
  app.get('/api/admin/orders',async request=>result(scoped<Order>('order',manage(request)).reverse()));
  app.post('/api/admin/orders/:id/progress',async request=>{
    const user=manage(request);const b=object(request.body);const id=(request.params as {id:string}).id;
    return result(store.transaction(()=>{const o=orderFor(user,id);if(!o.paidAt||['unpaid','cancelled','refunded','completed'].includes(o.status))fail(409,'ORDER_NOT_ACTIVE','订单当前不可推进');if(o.topupCents>0)fail(409,'TOPUP_REQUIRED','订单有待补差价');
      const allowed:Record<string,string[]>={paid:['purchasing'],purchasing:['portioning'],portioning:o.fulfillment==='pickup'?['ready_for_pickup']:['delivering'],ready_for_pickup:[],delivering:['completed']};
      if(!allowed[o.status]?.includes(String(b.status)))fail(409,'INVALID_TRANSITION','请按采购、分装、待提/配送、完成顺序推进');
      if(store.all<import('../../../packages/domain/src/index.ts').AfterSalesCase>('after_sales').some(c=>c.orderId===o.id&&c.status==='open'))fail(409,'AFTER_SALES_HOLD','订单有待处理售后，请先处理');
      const unresolved=o.items.some(i=>i.state==='active'&&i.groupId&&store.require<SplitGroup>('group',i.groupId).status==='recruiting');if(unresolved)fail(409,'GROUP_NOT_FULL','订单含未成团份额，请先截单处理');
      const previousStatus=o.status;o.status=b.status as OrderStatus;const photoUrls=urls(b.photoUrls),receiptUrls=urls(b.receiptUrls);o.photoUrls=[...new Set([...o.photoUrls,...photoUrls])];o.receiptUrls=[...new Set([...o.receiptUrls,...receiptUrls])];o.progress.push({id:uid('progress'),at:now(),status:o.status,note:optstr(b.note),photoUrls,receiptUrls});auditOperation(store,{action:'order_progressed',actorId:user.id,merchantId:o.merchantId,orderId:o.id,reason:optstr(b.note)||'推进履约',before:{status:previousStatus},after:{status:o.status}});return store.put('order',o);
    }));
  });
  app.post('/api/admin/orders/:id/attachments',async request=>{const user=manage(request);const b=object(request.body);const o=orderFor(user,(request.params as {id:string}).id);o.photoUrls=urls(b.photoUrls??o.photoUrls);o.receiptUrls=urls(b.receiptUrls??o.receiptUrls);return result(store.put('order',o));});
  app.post('/api/admin/orders/:id/weight-adjustment',async request=>{
    const user=manage(request);const b=object(request.body);const adjustmentId=str(b.adjustmentId,'调整幂等标识',100);const actualGoodsCents=cents(b.actualGoodsCents,'实际商品金额',1);const note=str(b.note,'差价原因',500);const hash=fingerprint(b);
    return result(store.transaction(()=>{const o=orderFor(user,(request.params as {id:string}).id);const previous=o.weightAdjustments.find(a=>a.adjustmentId===adjustmentId);if(previous){if(previous.actualGoodsCents!==actualGoodsCents||previous.note!==note||(previous.requestFingerprint&&previous.requestFingerprint!==hash))fail(409,'IDEMPOTENCY_CONFLICT','该调整标识已用于不同称重数据');return o;}if(!o.paidAt||!['paid','purchasing','portioning','awaiting_topup'].includes(o.status)||o.pickedUpAt)fail(409,'CANNOT_ADJUST','进入交付阶段后不能再调整称重价格，请走售后');if(!o.items.some(i=>activeQuantity(i)>0))fail(409,'CANNOT_ADJUST','订单没有有效商品');if(store.all<SplitGroup>('group').some(g=>o.items.some(i=>activeQuantity(i)>0&&i.groupId===g.id)&&g.status==='recruiting'))fail(409,'CLOSE_BATCH_FIRST','请先处理本批次未成团份额');const active=o.items.filter(i=>activeQuantity(i)>0);const prior=o.finalPricing.totalCents;
      if(b.itemGoods!==undefined){if(!Array.isArray(b.itemGoods)||b.itemGoods.length!==active.length)fail(400,'INVALID_INPUT','逐行实际金额须覆盖所有有效订单行');const seen=new Set<string>();let total=0;for(const raw of b.itemGoods){const line=object(raw);const id=str(line.itemId,'订单行');if(seen.has(id))fail(400,'DUPLICATE_ITEM','逐行金额不可重复');seen.add(id);const item=active.find(i=>i.id===id);if(!item)fail(400,'ITEM_NOT_FOUND','实际金额的订单行无效');item.settlementGoodsCents=cents(line.actualGoodsCents,'行实际商品金额');total+=item.settlementGoodsCents;}if(total!==actualGoodsCents)fail(400,'AMOUNT_MISMATCH','逐行实际金额与整单实际商品金额不一致');}
      else {const base=active.reduce((sum,i)=>sum+(i.settlementGoodsCents??i.unitPriceCents*activeQuantity(i)),0);let allocated=0;active.forEach((i,index)=>{const amount=index===active.length-1?actualGoodsCents-allocated:Number(BigInt(actualGoodsCents)*BigInt(i.settlementGoodsCents??i.unitPriceCents*activeQuantity(i))/BigInt(base));i.settlementGoodsCents=amount;allocated+=amount;});}
      repriceOrder(o);cents(o.finalPricing.totalCents,'复核后应付总额',1);o.weightAdjustments.push({adjustmentId,actualGoodsCents,deltaCents:o.finalPricing.totalCents-prior,note,at:now(),requestFingerprint:hash});reconcileOrder(store,o,{reference:`weight-refund:${o.id}:${adjustmentId}`,requestId:adjustmentId,type:'weight_adjustment',actorId:user.id,reason:`称重差价退款：${note}`});auditOperation(store,{action:'weight_adjusted',actorId:user.id,merchantId:o.merchantId,orderId:o.id,requestId:adjustmentId,reason:note,before:{totalCents:prior},after:{totalCents:o.finalPricing.totalCents,topupCents:o.topupCents,refundedCents:o.refundedCents,itemGoods:active.map(i=>({itemId:i.id,actualGoodsCents:i.settlementGoodsCents}))}});return store.put('order',o);}));
  });
  app.post('/api/admin/orders/:id/verify-pickup',async request=>{
    const user=manage(request);const b=object(request.body);const code=str(b.pickupCode,'提货码',100);return result(store.transaction(()=>{const o=orderFor(user,(request.params as {id:string}).id);if(code!==o.pickupCode)fail(400,'INVALID_PICKUP_CODE','提货码不匹配');if(o.pickedUpAt)return o;if(o.fulfillment!=='pickup'||o.status!=='ready_for_pickup'||o.topupCents>0)fail(409,'NOT_READY','订单未到可核销状态');if(store.all<import('../../../packages/domain/src/index.ts').AfterSalesCase>('after_sales').some(c=>c.orderId===o.id&&c.status==='open'))fail(409,'AFTER_SALES_HOLD','请先处理待办售后');o.status='completed';o.pickedUpAt=now();o.progress.push({id:uid('progress'),at:now(),status:'completed',note:'商户核验提货码，已完成自提',photoUrls:[],receiptUrls:[]});auditOperation(store,{action:'pickup_verified',actorId:user.id,merchantId:o.merchantId,orderId:o.id,reason:'核验提货码',after:{status:'completed'}});return store.put('order',o);}));
  });
  app.get('/api/admin/wallet',async request=>{auth(request,['admin']);const q=(request.query??{})as Record<string,string>;const customerId=str(q.customerId,'用户');store.require<User>('user',customerId);return result(walletFor(customerId));});
  return {app,store,config:{environment,devAuthEnabled,devPaymentsEnabled,uatMode}};
}
