export type Role = 'admin' | 'merchant' | 'customer';
export type Fulfillment = 'pickup' | 'delivery';
export interface User { id: string; nickname: string; role: Role; merchantId?: string }
export interface Merchant {
  id: string; name: string; city: string; status: 'pending' | 'approved' | 'rejected' | 'paused';
  contactName: string; contactPhone: string; description?: string; reviewReason?: string; createdAt: string;
}
export interface Community { id: string; merchantId: string; name: string; station: string; address: string; active?:boolean }
export interface ProductOption {
  id: string; name: string; ratio: number; slots: number; weightEstimate: string; priceCents: number; description: string;
}
export interface Product {
  id: string; merchantId: string; name: string; subtitle: string; categoryId: string;
  originalPriceCents: number; originalSpecs: string; canSplit: boolean; requiresColdChain: boolean;
  stock: number; salesCount: number; tags: string[]; bannerBadge?: string;
  iconType: string; accentColor: string; options: ProductOption[]; active: boolean;
  version?: number; inventoryUnits?: number; inventoryScale?: number; inventoryNeedsReview?: boolean;
  legacyStock?: number;
}
export type BatchStatus = 'open' | 'purchasing' | 'portioning' | 'ready_for_pickup' | 'completed' | 'cancelled';
export interface Batch {
  id: string; merchantId: string; title: string; storeName: string; cutoffAt: string;
  pickupStartAt: string; pickupEndAt: string; status: BatchStatus; closedAt?: string;
  shopperName: string; shopperPhone: string; note: string; photoUrls: string[]; receiptUrls: string[];
}
export interface GroupParticipant { userId: string; nickname: string; orderId: string; quantity: number; paidAt: string }
export interface SplitGroup {
  id: string; merchantId: string; productId: string; optionId: string; batchId: string; communityId: string;
  productName: string; totalSlots: number; paidSlots: number; pricePerSlotCents: number; slotDescription: string;
  note?: string;
  optionSnapshot?: ProductOption; productVersion?: number;
  status: 'recruiting' | 'full' | 'purchasing' | 'completed' | 'failed'; cutoffAt: string;
  participants: GroupParticipant[]; createdBy: string; createdAt: string;
}
export interface OrderItemInput { productId: string; optionId: string; quantity: number; groupId?: string }
export interface CheckoutInput {
  merchantId: string; communityId: string; batchId: string; fulfillment: Fulfillment; items: OrderItemInput[];
  recipientName: string; recipientPhone: string; address?: string; notes?: string;
  requestId?: string;
}
export interface OrderItem extends OrderItemInput {
  name: string; optionName: string; unitPriceCents: number; weightEstimate: string;
  isSplit: boolean; requiresColdChain: boolean; state: 'active' | 'refunded';
  id?: string; optionSnapshot?: ProductOption; productVersion?: number; unitsPerQuantity?: number;
  cancelledQuantity?: number; settlementGoodsCents?: number; inventoryReservationRecorded?: boolean;
}
export interface Pricing {
  subtotalCents: number; proxyFeeCents: number; packagingFeeCents: number;
  deliveryFeeCents: number; discountCents: number; totalCents: number;
}
export type OrderStatus = 'unpaid' | 'paid' | 'awaiting_topup' | 'purchasing' | 'portioning' | 'ready_for_pickup' | 'delivering' | 'completed' | 'refunded' | 'cancelled';
export interface ProgressEntry { id: string; at: string; status: OrderStatus; note: string; photoUrls: string[]; receiptUrls: string[] }
export interface WeightAdjustment { adjustmentId: string; actualGoodsCents: number; deltaCents: number; note: string; at: string; requestFingerprint?:string }
export interface Order extends CheckoutInput {
  id: string; customerId: string; createdAt: string; paidAt?: string; status: OrderStatus; items: OrderItem[];
  pricing: Pricing; finalPricing: Pricing; paidCents: number; refundedCents: number; topupCents: number;
  paymentMethod?: string; pickupCode?: string; pickedUpAt?: string; progress: ProgressEntry[];
  isTest?: true;
  statusBeforeTopup?: OrderStatus;
  merchantSnapshot?: {id:string;name:string;city:string;legacy?:boolean};
  communitySnapshot?: {id:string;name:string;station:string;address:string;legacy?:boolean};
  batchSnapshot?: {id:string;title:string;storeName:string;cutoffAt:string;pickupStartAt:string;pickupEndAt:string;legacy?:boolean};
  financialStatus?: 'unpaid'|'settled'|'topup_due'|'partially_refunded'|'refunded';
  afterSalesCreditCents?: number; payments?: PaymentRecord[]; refunds?: RefundRecord[];
  weightAdjustments: WeightAdjustment[]; photoUrls: string[]; receiptUrls: string[];
}
export interface PaymentRecord { id:string;kind:'initial'|'topup';method:'dev'|'wallet'|'test';amountCents:number;reference:string;createdAt:string }
export interface RefundRecord { id:string;requestId:string;type:string;amountCents:number;reason:string;createdAt:string;actorId:string;items?:{itemId:string;quantity:number}[] }
export interface AfterSalesCase { id:string;orderId:string;customerId:string;merchantId:string;status:'open'|'approved'|'rejected';reason:string;requestedRefundCents?:number;refundCents?:number;reviewReason?:string;reviewedBy?:string;createdAt:string;reviewedAt?:string }
export interface OperationAudit { id:string;action:string;actorId:string;merchantId?:string;orderId?:string;requestId?:string;reason:string;before?:unknown;after?:unknown;createdAt:string }
export const INVENTORY_SCALE=232792560;
export interface WalletEntry { id: string; userId: string; amountCents: number; balanceAfterCents: number; reference: string; kind: string; note: string; createdAt: string; merchantId?: string; orderId?: string }
export interface Wallet { balanceCents: number; entries: WalletEntry[]; isTest?: true }

export function assertCents(value: unknown, field = 'amount'): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 100_000_000) throw new Error(`${field} 必须是非负整数分且不超过100万元`);
}
export function calculatePricing(subtotalCents: number, hasColdChain: boolean, fulfillment: Fulfillment, discountCents = 0): Pricing {
  assertCents(subtotalCents, 'subtotalCents'); assertCents(discountCents, 'discountCents');
  if (fulfillment !== 'pickup' && fulfillment !== 'delivery') throw new Error('无效的配送方式');
  const proxyFeeCents = subtotalCents === 0 ? 0 : Math.max(400, Math.min(2500, Math.round(subtotalCents * 0.06 / 10) * 10));
  const packagingFeeCents = subtotalCents > 0 && hasColdChain && subtotalCents < 19900 ? 300 : 0;
  const deliveryFeeCents = subtotalCents > 0 && fulfillment === 'delivery' && subtotalCents < 29900 ? 800 : 0;
  const discount = Math.min(discountCents, subtotalCents);
  return { subtotalCents, proxyFeeCents, packagingFeeCents, deliveryFeeCents, discountCents: discount, totalCents: subtotalCents + proxyFeeCents + packagingFeeCents + deliveryFeeCents - discount };
}
export function formatCents(cents: number): string { return `¥${(cents / 100).toFixed(2)}`; }
