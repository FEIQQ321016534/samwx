import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AfterSalesCase, Batch, Community, OperationAudit, Order, Product, SplitGroup, User } from '../../../packages/domain/src/index.ts';
import { INVENTORY_SCALE } from '../../../packages/domain/src/index.ts';
import { Store, fail, now, uid } from './db.ts';
import { activeQuantity, auditOperation, cancelOrderItems, cents, effectiveDue, executeOnce, inventoryProduct, reconcileOrder, snapshotOrder, updateFinancialStatus } from './operations.ts';

type Body=Record<string,unknown>;
const body=(value:unknown):Body=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'INVALID_INPUT','请求数据须为对象');return value as Body;};
const text=(value:unknown,label:string,max=500)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail(400,'INVALID_INPUT',`${label}必填且不超过${max}字`);return value.trim();};
const idOf=(request:FastifyRequest)=>(request.params as{id:string}).id;
const data=<T>(value:T)=>({data:value});
export interface OperationsContext {auth:(request:FastifyRequest,roles?:User['role'][])=>User;manage:(request:FastifyRequest)=>User;scope:(user:User,merchantId:string)=>void;orderFor:(user:User,id:string)=>Order;isTest?:boolean}
const summary=(o:Order)=>({status:o.status,pricing:o.finalPricing,paidCents:o.paidCents,refundedCents:o.refundedCents,topupCents:o.topupCents,financialStatus:o.financialStatus});

export function registerOperationsRoutes(app:FastifyInstance,store:Store,ctx:OperationsContext){
  const scopedOrders=(user:User)=>store.all<Order>('order').filter(o=>user.role==='admin'||o.merchantId===user.merchantId);
  const releaseMembership=(order:Order,lines:{itemId:string;quantity:number}[])=>{
    for(const line of lines){const item=order.items.find(i=>i.id===line.itemId);if(!item?.groupId)continue;const group=store.require<SplitGroup>('group',item.groupId);const participant=group.participants.find(p=>p.orderId===order.id);if(participant){const released=Math.min(line.quantity,participant.quantity);participant.quantity-=released;group.paidSlots=Math.max(0,group.paidSlots-released);group.participants=group.participants.filter(p=>p.quantity>0);}
      const batch=store.require<Batch>('batch',order.batchId);if(batch.status==='open'&&!batch.closedAt&&Date.parse(batch.cutoffAt)>Date.now())group.status=group.paidSlots===group.totalSlots?'full':'recruiting';store.put('group',group);
    }
  };
  const refund=(user:User,order:Order,requestId:string,amountCents:number,reason:string,type='after_sales')=>{
    if(!order.paidAt)fail(409,'ORDER_NOT_PAID','未付款订单不能退款');if(order.topupCents>0)fail(409,'RESOLVE_TOPUP_FIRST','先复核待补金额，再确定售后退款');
    const net=order.paidCents-order.refundedCents;cents(amountCents,'退款金额',1);if(amountCents>net)fail(409,'REFUND_EXCEEDS_PAID','退款不能超过剩余实收金额');
    const before=summary(order);const fulfilled=order.status==='completed'||Boolean(order.pickedUpAt);
    if(amountCents===net&&!fulfilled){const lines=order.items.filter(i=>activeQuantity(i)>0).map(i=>({itemId:i.id!,quantity:activeQuantity(i)}));cancelOrderItems(store,order,lines,order.status==='paid');releaseMembership(order,lines);order.afterSalesCreditCents=0;}
    else order.afterSalesCreditCents=(order.afterSalesCreditCents??0)+amountCents;
    const refunded=reconcileOrder(store,order,{reference:`manual-refund:${order.id}:${requestId}`,requestId,type,actorId:user.id,reason});if(refunded!==amountCents)fail(409,'FINANCIAL_REVIEW_REQUIRED','退款金额与订单应收差异不符，请先对账');
    store.put('order',order);auditOperation(store,{action:type,actorId:user.id,merchantId:order.merchantId,orderId:order.id,requestId,reason,before,after:summary(order)});return order;
  };

  app.get('/api/admin/communities/:id',async request=>{const user=ctx.manage(request);const community=store.require<Community>('community',idOf(request));ctx.scope(user,community.merchantId);return data(community);});
  app.patch('/api/admin/communities/:id',async request=>{const user=ctx.manage(request);const b=body(request.body);return data(store.transaction(()=>{const community=store.require<Community>('community',idOf(request));ctx.scope(user,community.merchantId);for(const field of ['id','merchantId'])if(field in b&&b[field]!==community[field as keyof Community])fail(400,'IMMUTABLE_FIELD','不能更改社区ID或商户归属');const before={...community};for(const field of ['name','station','address']as const)if(field in b)community[field]=text(b[field],field,300);if('active'in b){if(typeof b.active!=='boolean')fail(400,'INVALID_INPUT','active须为布尔值');community.active=b.active;}store.put('community',community);auditOperation(store,{action:'community_updated',actorId:user.id,merchantId:community.merchantId,reason:'社区设置更新',before,after:community});return community;}));});
  app.post('/api/admin/products/:id/inventory',async request=>{const user=ctx.manage(request);const b=body(request.body);const requestId=text(b.requestId,'requestId',120),reason=text(b.reason,'实盘原因');const wholePacks=b.wholePacks;if(!Number.isInteger(wholePacks)||(wholePacks as number)<0||(wholePacks as number)>1_000_000)fail(400,'INVALID_INVENTORY','可售整包库存须为0至100万整数');ctx.scope(user,store.require<Product>('product',idOf(request)).merchantId);return data(store.transaction(()=>executeOnce(store,user,`inventory:${idOf(request)}`,requestId,b,()=>{const product=inventoryProduct(store,store.require<Product>('product',idOf(request)));ctx.scope(user,product.merchantId);const before={inventoryUnits:product.inventoryUnits,inventoryNeedsReview:product.inventoryNeedsReview};product.inventoryUnits=(wholePacks as number)*INVENTORY_SCALE;product.inventoryScale=INVENTORY_SCALE;product.inventoryNeedsReview=false;product.stock=wholePacks as number;product.version=(product.version??1)+1;store.put('product',product);auditOperation(store,{action:'inventory_counted',actorId:user.id,merchantId:product.merchantId,requestId,reason,before,after:{inventoryUnits:product.inventoryUnits,inventoryNeedsReview:false}});return product;})));});
  app.post('/api/orders/:id/after-sales',async request=>{const user=ctx.auth(request,['customer']);const b=body(request.body);const requestId=text(b.requestId,'requestId',120),reason=text(b.reason,'售后原因');ctx.orderFor(user,idOf(request));return data(store.transaction(()=>executeOnce(store,user,`after-sales:${idOf(request)}`,requestId,b,()=>{const order=ctx.orderFor(user,idOf(request));if(!order.paidAt||order.paidCents===order.refundedCents)fail(409,'ORDER_NOT_REFUNDABLE','订单未支付或已全额退款');if(store.all<AfterSalesCase>('after_sales').some(c=>c.orderId===order.id&&c.status==='open'))fail(409,'AFTER_SALES_ALREADY_OPEN','本订单已有待处理售后');const requested=b.requestedRefundCents===undefined?undefined:cents(b.requestedRefundCents,'申请退款金额',1);if(requested!==undefined&&requested>order.paidCents-order.refundedCents)fail(400,'REFUND_EXCEEDS_PAID','申请金额超过剩余实收');const c:AfterSalesCase={id:uid('after-sales'),orderId:order.id,customerId:user.id,merchantId:order.merchantId,status:'open',reason,requestedRefundCents:requested,createdAt:now()};store.put('after_sales',c);auditOperation(store,{action:'after_sales_requested',actorId:user.id,merchantId:order.merchantId,orderId:order.id,requestId,reason,after:{caseId:c.id,requestedRefundCents:requested}});return c;})));});
  app.get('/api/orders/:id/after-sales',async request=>{const user=ctx.auth(request);ctx.orderFor(user,idOf(request));return data(store.all<AfterSalesCase>('after_sales').filter(c=>c.orderId===idOf(request)).reverse());});
  app.get('/api/admin/after-sales',async request=>{const user=ctx.manage(request);return data(store.all<AfterSalesCase>('after_sales').filter(c=>user.role==='admin'||c.merchantId===user.merchantId).reverse());});
  app.post('/api/admin/after-sales/:id/review',async request=>{const user=ctx.manage(request);const b=body(request.body);const requestId=text(b.requestId,'requestId',120),reason=text(b.reason,'处理原因');if(b.action!=='approve'&&b.action!=='reject')fail(400,'INVALID_INPUT','请选择同意或拒绝');ctx.scope(user,store.require<AfterSalesCase>('after_sales',idOf(request)).merchantId);return data(store.transaction(()=>executeOnce(store,user,`after-sales-review:${idOf(request)}`,requestId,b,()=>{const c=store.require<AfterSalesCase>('after_sales',idOf(request));ctx.scope(user,c.merchantId);if(c.status!=='open')fail(409,'AFTER_SALES_ALREADY_REVIEWED','该售后已经处理');let order=snapshotOrder(store,ctx.orderFor(user,c.orderId));if(b.action==='approve'){const amount=cents(b.refundCents??c.requestedRefundCents,'同意退款金额',1);order=refund(user,order,`case-${c.id}-${requestId}`,amount,reason,'after_sales_approved');c.refundCents=amount;c.status='approved';}else c.status='rejected';c.reviewReason=reason;c.reviewedBy=user.id;c.reviewedAt=now();store.put('after_sales',c);auditOperation(store,{action:'after_sales_reviewed',actorId:user.id,merchantId:c.merchantId,orderId:c.orderId,requestId,reason,after:{caseId:c.id,status:c.status,refundCents:c.refundCents}});return{case:c,order};})));});
  app.post('/api/admin/orders/:id/refund',async request=>{const user=ctx.manage(request);const b=body(request.body);const requestId=text(b.requestId,'requestId',120),reason=text(b.reason,'退款原因');const amount=cents(b.amountCents,'退款金额',1);ctx.orderFor(user,idOf(request));return data(store.transaction(()=>executeOnce(store,user,`refund:${idOf(request)}`,requestId,b,()=>refund(user,snapshotOrder(store,ctx.orderFor(user,idOf(request))),requestId,amount,reason))));});
  app.post('/api/admin/orders/:id/items/cancel',async request=>{const user=ctx.manage(request);const b=body(request.body);const requestId=text(b.requestId,'requestId',120),reason=text(b.reason,'取消原因');ctx.orderFor(user,idOf(request));if(b.type!=='out_of_stock'&&b.type!=='customer_cancel')fail(400,'INVALID_INPUT','取消类型无效');if(!Array.isArray(b.items)||!b.items.length)fail(400,'INVALID_INPUT','请选择取消商品行');const lines=b.items.map(raw=>{const i=body(raw);if(!Number.isInteger(i.quantity)||(i.quantity as number)<1)fail(400,'INVALID_INPUT','取消数量须为正整数');return{itemId:text(i.itemId,'订单行ID',100),quantity:i.quantity as number};});return data(store.transaction(()=>executeOnce(store,user,`cancel-items:${idOf(request)}`,requestId,b,()=>{const order=snapshotOrder(store,ctx.orderFor(user,idOf(request)));if(!order.paidAt||['refunded','cancelled','ready_for_pickup','delivering','completed'].includes(order.status)||order.pickedUpAt)fail(409,'CANNOT_CANCEL_ITEMS','此订单已进入交付或结束，不可再取消商品，请用售后退款');const before=summary(order);if(b.restoreInventory!==undefined&&typeof b.restoreInventory!=='boolean')fail(400,'INVALID_INPUT','restoreInventory须为布尔值');const restore=b.restoreInventory===true||(b.restoreInventory===undefined&&b.type==='customer_cancel'&&order.status==='paid');cancelOrderItems(store,order,lines,restore);releaseMembership(order,lines);reconcileOrder(store,order,{reference:`items-cancel:${order.id}:${requestId}`,requestId,type:String(b.type),actorId:user.id,reason,items:lines});store.put('order',order);auditOperation(store,{action:String(b.type),actorId:user.id,merchantId:order.merchantId,orderId:order.id,requestId,reason,before,after:{...summary(order),items:lines,restoreInventory:restore}});return order;})));});
  app.post('/api/admin/batches/:id/cancel',async request=>{const user=ctx.manage(request);const b=body(request.body);const requestId=text(b.requestId,'requestId',120),reason=text(b.reason,'取消批次原因');ctx.scope(user,store.require<Batch>('batch',idOf(request)).merchantId);return data(store.transaction(()=>executeOnce(store,user,`cancel-batch:${idOf(request)}`,requestId,b,()=>{const batch=store.require<Batch>('batch',idOf(request));ctx.scope(user,batch.merchantId);if(batch.status==='cancelled')fail(409,'BATCH_ALREADY_CANCELLED','该批次已取消');const orders=store.all<Order>('order').filter(o=>o.batchId===batch.id);if(orders.some(o=>['ready_for_pickup','delivering','completed'].includes(o.status)||o.pickedUpAt))fail(409,'BATCH_FULFILLMENT_STARTED','批次已有订单进入交付，须逐单售后处理');let cancelledOrders=0,refundCents=0;for(const raw of orders){const order=snapshotOrder(store,raw);if(order.status==='cancelled'||order.status==='refunded')continue;if(!order.paidAt){order.status='cancelled';store.put('order',order);cancelledOrders++;continue;}const before=summary(order);const lines=order.items.filter(i=>activeQuantity(i)>0).map(i=>({itemId:i.id!,quantity:activeQuantity(i)}));cancelOrderItems(store,order,lines,order.status==='paid');releaseMembership(order,lines);order.afterSalesCreditCents=0;refundCents+=reconcileOrder(store,order,{reference:`batch-cancel:${batch.id}:${order.id}`,requestId,type:'batch_cancel',actorId:user.id,reason,items:lines});store.put('order',order);auditOperation(store,{action:'batch_order_cancelled',actorId:user.id,merchantId:batch.merchantId,orderId:order.id,requestId,reason,before,after:summary(order)});cancelledOrders++;}for(const group of store.all<SplitGroup>('group').filter(g=>g.batchId===batch.id)){group.status='failed';store.put('group',group);}batch.status='cancelled';batch.closedAt??=now();store.put('batch',batch);auditOperation(store,{action:'batch_cancelled',actorId:user.id,merchantId:batch.merchantId,requestId,reason,after:{batchId:batch.id,cancelledOrders,refundCents}});return{batch,cancelledOrders,refundCents};})));});
  app.get('/api/admin/audit',async request=>{const user=ctx.manage(request);return data(store.all<OperationAudit>('operation_audit').filter(a=>user.role==='admin'||a.merchantId===user.merchantId).reverse().slice(0,500));});
  app.get('/api/admin/reconciliation', async request => {
    const user = ctx.manage(request);
    const q = (request.query ?? {}) as Record<string, string>;
    if (q.merchantId) ctx.scope(user, q.merchantId);
    const orders = scopedOrders(user).filter(o => (!q.merchantId || o.merchantId === q.merchantId) && (!q.batchId || o.batchId === q.batchId));
    const readLedger = store.db.prepare('SELECT amount_cents,kind FROM wallet_entries WHERE order_id=?');
    const rows = orders.map(order => {
      const ledger = readLedger.all(order.id) as { amount_cents: number; kind: string }[];
      const walletRefundCents = ledger.filter(e => e.kind === 'refund').reduce((sum, e) => sum + e.amount_cents, 0);
      const walletPaymentCents = -ledger.filter(e => e.kind === 'payment' || e.kind === 'topup').reduce((sum, e) => sum + e.amount_cents, 0);
      const testFundingCents = ledger.filter(e => e.kind === 'test_funding').reduce((sum, e) => sum + e.amount_cents, 0);
      const netReceivedCents = order.paidCents - order.refundedCents;
      const amountDueCents = effectiveDue(order);
      const issues: string[] = [];
      if (walletRefundCents !== order.refundedCents) issues.push('REFUND_LEDGER_MISMATCH');
      if (netReceivedCents < 0) issues.push('REFUND_EXCEEDS_PAID');
      const payments = order.payments ?? [];
      if (order.paidAt && payments.length) {
        if (payments.reduce((sum, p) => sum + p.amountCents, 0) !== order.paidCents) issues.push('PAYMENT_RECORD_MISMATCH');
        const ledgerPayments = payments.filter(p => p.method === 'wallet' || p.method === 'test');
        if (ledgerPayments.reduce((sum, p) => sum + p.amountCents, 0) !== walletPaymentCents) issues.push('WALLET_PAYMENT_MISMATCH');
      }
      const expectedTestFunding = payments.filter(p => p.method === 'test').reduce((sum, p) => sum + p.amountCents, 0);
      if (testFundingCents !== expectedTestFunding) issues.push('TEST_FUNDING_MISMATCH');
      if (order.paidAt && Math.max(0, amountDueCents - netReceivedCents) !== order.topupCents) issues.push('TOPUP_MISMATCH');
      return { orderId: order.id, paidCents: order.paidCents, refundedCents: order.refundedCents, netReceivedCents, amountDueCents, topupCents: order.topupCents, walletPaymentCents, walletRefundCents, testFundingCents, discrepancies: issues };
    });
    const total = (field: 'paidCents' | 'refundedCents' | 'netReceivedCents' | 'amountDueCents' | 'topupCents' | 'walletRefundCents' | 'testFundingCents') => rows.reduce((sum, row) => sum + row[field], 0);
    return data({
      orderCount: rows.length,
      orders: rows,
      paidCents: total('paidCents'),
      refundedCents: total('refundedCents'),
      netReceivedCents: total('netReceivedCents'),
      amountDueCents: total('amountDueCents'),
      topupCents: total('topupCents'),
      walletRefundCents: total('walletRefundCents'),
      ...(ctx.isTest ? { isTest: true, testFundingCents: total('testFundingCents') } : {}),
      discrepancies: rows.flatMap(row => row.discrepancies.map(code => ({ orderId: row.orderId, code, message: code }))),
    });
  });
}
