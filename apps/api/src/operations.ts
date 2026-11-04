import { createHash } from 'node:crypto';
import type { Batch, Community, Merchant, OperationAudit, Order, OrderItem, Product, ProductOption, User } from '../../../packages/domain/src/index.ts';
import { calculatePricing, INVENTORY_SCALE } from '../../../packages/domain/src/index.ts';
import { Store, fail, now, uid } from './db.ts';

export const MAX_GOODS_CENTS=100_000_000;
export function cents(value: unknown,label='金额',minimum=0): number { if(!Number.isSafeInteger(value)||(value as number)<minimum||(value as number)>MAX_GOODS_CENTS)fail(400,'INVALID_AMOUNT',`${label}须为${minimum}至${MAX_GOODS_CENTS}之间的整数分`);return value as number; }
export function auditOperation(store:Store,event:Omit<OperationAudit,'id'|'createdAt'>){store.put('operation_audit',{...event,id:uid('op-audit'),createdAt:now()});}
export function activeQuantity(item:OrderItem){return item.quantity-(item.cancelledQuantity??(item.state==='refunded'?item.quantity:0));}
export function optionUnits(option:Pick<ProductOption,'slots'>){if(!Number.isInteger(option.slots)||option.slots<1||option.slots>20||INVENTORY_SCALE%option.slots!==0)fail(400,'INVALID_OPTION','拆分份数须为1至20的整数');return INVENTORY_SCALE/option.slots;}
export function inventoryProduct(store:Store,product:Product):Product {
  if(product.inventoryUnits===undefined){
    const history=store.all<Order>('order').some(o=>o.paidAt&&o.items.some(i=>i.productId===product.id));
    product.legacyStock=product.stock;product.inventoryScale=INVENTORY_SCALE;product.inventoryUnits=Math.max(0,Math.floor(product.stock))*INVENTORY_SCALE;product.inventoryNeedsReview=history;product.version??=1;store.put('product',product);
  }
  if(product.inventoryScale!==INVENTORY_SCALE||!Number.isSafeInteger(product.inventoryUnits)||product.inventoryUnits<0)fail(409,'INVENTORY_REVIEW_REQUIRED','库存换算异常，请先实盘核对');
  return product;
}
export function assertInventoryAvailable(store:Store,product:Product,units:number){inventoryProduct(store,product);if(product.inventoryNeedsReview)fail(409,'INVENTORY_REVIEW_REQUIRED',`${product.name}为旧库存，须由商户实盘核对后恢复接单`);if(product.inventoryUnits!<units)fail(409,'OUT_OF_STOCK',`${product.name}库存不足`);}
export function reserveInventory(store:Store,order:Order){
  const totals=new Map<string,{units:number;quantity:number}>();
  for(const item of order.items){const total=totals.get(item.productId)??{units:0,quantity:0};if(!item.unitsPerQuantity)fail(409,'LEGACY_ORDER_RECREATE','旧版未付订单缺少库存快照，请重新下单');total.units+=item.unitsPerQuantity*activeQuantity(item);total.quantity+=activeQuantity(item);totals.set(item.productId,total);}
  for(const[id,total]of totals){const product=store.require<Product>('product',id);if(!product.active)fail(409,'PRODUCT_UNAVAILABLE','商品已暂停接单');assertInventoryAvailable(store,product,total.units);product.inventoryUnits!-=total.units;product.stock=Math.max(0,product.stock-total.quantity);product.salesCount+=total.quantity;store.put('product',product);}
  order.items.forEach(i=>{i.inventoryReservationRecorded=true;});
}
export function restoreInventory(store:Store,item:OrderItem,quantity:number){
  const product=store.get<Product>('product',item.productId);if(!product)return;
  inventoryProduct(store,product);
  if(item.inventoryReservationRecorded&&item.unitsPerQuantity){product.inventoryUnits!+=item.unitsPerQuantity*quantity;product.stock+=quantity;product.salesCount=Math.max(0,product.salesCount-quantity);}
  else product.inventoryNeedsReview=true;
  store.put('product',product);
}
export function snapshotOrder(store:Store,order:Order,legacy=false){
  const merchant=store.get<Merchant>('merchant',order.merchantId),community=store.get<Community>('community',order.communityId),batch=store.get<Batch>('batch',order.batchId);
  order.merchantSnapshot??={id:order.merchantId,name:merchant?.name??'原代购商',city:merchant?.city??'烟台市',...(legacy?{legacy:true}:{})};
  order.communitySnapshot??={id:order.communityId,name:community?.name??'原社区',station:community?.station??'请联系原商户确认站点',address:community?.address??order.address??'请联系原商户确认地址',...(legacy?{legacy:true}:{})};
  order.batchSnapshot??={id:order.batchId,title:batch?.title??'原采购批次',storeName:batch?.storeName??'',cutoffAt:batch?.cutoffAt??order.createdAt,pickupStartAt:batch?.pickupStartAt??'',pickupEndAt:batch?.pickupEndAt??'',...(legacy?{legacy:true}:{})};
  order.items.forEach((item,index)=>{item.id??=`item-${index}`;item.cancelledQuantity??=item.state==='refunded'?item.quantity:0;item.settlementGoodsCents??=item.unitPriceCents*activeQuantity(item);});
  order.payments??=[];order.refunds??=[];order.afterSalesCreditCents??=0;
  updateFinancialStatus(order);
  return order;
}
export function initializeOperations(store:Store){store.transaction(()=>{
  store.all<Product>('product').forEach(product=>inventoryProduct(store,product));
  for(const order of store.all<Order>('order'))store.put('order',snapshotOrder(store,order,true));
  for(const group of store.all<import('../../../packages/domain/src/index.ts').SplitGroup>('group')){const product=store.get<Product>('product',group.productId);if(!group.optionSnapshot){const option=product?.options.find(o=>o.id===group.optionId);if(option&&option.slots===group.totalSlots)group.optionSnapshot={...option,priceCents:group.pricePerSlotCents};}group.productVersion??=product?.version??1;store.put('group',group);}
});}
export function effectiveDue(order:Order){return Math.max(0,order.finalPricing.totalCents-(order.afterSalesCreditCents??0));}
export function updateFinancialStatus(order:Order){
  const due=effectiveDue(order),net=order.paidCents-order.refundedCents;
  order.financialStatus=!order.paidAt?'unpaid':order.topupCents>0?'topup_due':due===0&&net===0?'refunded':order.refundedCents>0?'partially_refunded':'settled';
}
export function reconcileOrder(store:Store,order:Order,input:{reference:string;requestId:string;type:string;actorId:string;reason:string;items?:{itemId:string;quantity:number}[]}){
  if(!Number.isSafeInteger(order.paidCents)||!Number.isSafeInteger(order.refundedCents)||order.refundedCents<0||order.paidCents<order.refundedCents)fail(409,'FINANCIAL_REVIEW_REQUIRED','原订单资金记录异常，须人工对账');
  const due=effectiveDue(order),net=order.paidCents-order.refundedCents,refund=Math.max(0,net-due);
  if (refund > 0) {
    const note = order.isTest ? `测试余额退款（无真实资金） · ${input.reason}` : input.reason;
    store.ledger(order.customerId, refund, input.reference, 'refund', note, order.merchantId, order.id);
    order.refundedCents += refund;
    (order.refunds ??= []).push({ id: uid('refund'), requestId: input.requestId, type: input.type, amountCents: refund, reason: input.reason, createdAt: now(), actorId: input.actorId, ...(input.items ? { items: input.items } : {}) });
  }
  order.topupCents=Math.max(0,due-(order.paidCents-order.refundedCents));
  const fulfilled=order.status==='completed'||Boolean(order.pickedUpAt);
  if(!fulfilled&&due===0&&order.paidAt&&!order.items.some(i=>activeQuantity(i)>0)){order.status='refunded';delete order.statusBeforeTopup;}
  else if(order.topupCents>0){if(fulfilled||['ready_for_pickup','delivering'].includes(order.status))fail(409,'FULFILLMENT_STARTED','已进入交付阶段，不能再增加补款');if(order.status!=='awaiting_topup')order.statusBeforeTopup=order.status;order.status='awaiting_topup';}
  else if(order.status==='awaiting_topup'){order.status=order.statusBeforeTopup??'paid';delete order.statusBeforeTopup;}
  updateFinancialStatus(order);return refund;
}
export function repriceOrder(order:Order,preserveFeeWaivers=false){
  const active=order.items.filter(i=>activeQuantity(i)>0);const subtotal=active.reduce((sum,i)=>sum+(i.settlementGoodsCents??i.unitPriceCents*activeQuantity(i)),0);cents(subtotal,'商品总金额');
  const pricing=calculatePricing(subtotal,active.some(i=>i.requiresColdChain),order.fulfillment);
  if(preserveFeeWaivers)for(const fee of ['proxyFeeCents','packagingFeeCents','deliveryFeeCents']as const)pricing[fee]=Math.min(pricing[fee],order.pricing[fee]);
  pricing.totalCents=pricing.subtotalCents+pricing.proxyFeeCents+pricing.packagingFeeCents+pricing.deliveryFeeCents-pricing.discountCents;order.finalPricing=pricing;return pricing;
}
export function cancelOrderItems(store:Store,order:Order,lines:{itemId:string;quantity:number}[],restore:boolean){
  const seen=new Set<string>();for(const line of lines){if(seen.has(line.itemId))fail(400,'DUPLICATE_ITEM','不可重复取消同一订单行');seen.add(line.itemId);const item=order.items.find(i=>i.id===line.itemId);if(!item)fail(400,'ITEM_NOT_FOUND','订单行不存在');const remaining=activeQuantity(item);if(!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>remaining)fail(409,'CANCEL_QUANTITY_EXCEEDED','取消数量超过剩余有效份数');
    const current=item.settlementGoodsCents??item.unitPriceCents*remaining;const removed=line.quantity===remaining?current:Math.floor(current*line.quantity/remaining);item.settlementGoodsCents=current-removed;item.cancelledQuantity=(item.cancelledQuantity??0)+line.quantity;if(activeQuantity(item)===0)item.state='refunded';if(restore)restoreInventory(store,item,line.quantity);
  }repriceOrder(order,true);
}
function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
export function fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export function executeOnce<T>(store:Store,user:User,route:string,requestId:string,payload:unknown,action:()=>T):T {
  if(!requestId||requestId.length>120||!/[A-Za-z0-9]/.test(requestId))fail(400,'IDEMPOTENCY_KEY_REQUIRED','请提供1至120字的requestId用于安全重试');
  const id=fingerprint([user.id,route,requestId]),hash=fingerprint(payload),existing=store.get<{id:string;hash:string;result:T}>('request_dedup',id);if(existing){if(existing.hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT','相同requestId不能用于不同请求内容');return existing.result;}
  const result=action();store.put('request_dedup',{id,hash,result,createdAt:now(),userId:user.id,route,requestId});return result;
}
