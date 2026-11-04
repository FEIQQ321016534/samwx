/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SplitOption {
  id: string;
  name: string; // e.g. "半盒 (8片)", "1/4装 (4片)", "整盒原装"
  ratio: number; // 0.5, 0.25, 1.0
  slots: number; // how many slots in total for this share
  weightEstimate: string; // e.g. "约600g"
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  originalPrice: number;
  selectedOption: SplitOption;
  unitPrice: number;
  quantity: number;
  requiresColdChain: boolean;
  isGroupBuy: boolean;
  groupId?: string;
}

export interface OrderPricingBreakdown {
  itemsSubtotal: number;
  proxyFee: number;
  packagingFee: number;
  deliveryFee: number;
  discount: number;
  totalPayable: number;
  savingsVsWholeItem?: number;
}

/**
 * Calculates price for a portion of an item.
 * Typically basePrice * ratio, rounded to 1 decimal place or standard 2 decimals.
 */
export function calculateSplitPrice(basePrice: number, ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio >= 1) return basePrice;
  // Sam's proxy typically rounds up or adds tiny split handling e.g. 68 * 0.5 = 34
  const raw = basePrice * ratio;
  return Math.round(raw * 10) / 10;
}

/**
 * Transparent proxy fee calculation:
 * Default 6% of items subtotal, minimum 4元 (cover mileage/parking), capped at 25元.
 */
export function calculateProxyFee(
  subtotal: number,
  rate = 0.06,
  minFee = 4.0,
  maxFee = 25.0
): number {
  if (subtotal <= 0) return 0;
  const raw = subtotal * rate;
  const clamped = Math.max(minFee, Math.min(raw, maxFee));
  return Math.round(clamped * 10) / 10;
}

/**
 * Cold chain / insulation packaging fee calculation:
 * Free if subtotal > 150 or no cold items, otherwise 3元 for ice pack & insulated bag.
 */
export function calculatePackagingFee(requiresColdChain: boolean, subtotal: number): number {
  if (!requiresColdChain || subtotal <= 0) return 0;
  if (subtotal >= 199) return 0; // Free insulated box threshold
  return 3.0;
}

/**
 * Delivery fee:
 * Pickup point (自提点): 0元
 * Flash local delivery (同城闪送/送货上楼): 8元 (free over 299)
 */
export function calculateDeliveryFee(method: 'pickup' | 'delivery', subtotal: number): number {
  if (method === 'pickup') return 0;
  if (subtotal >= 299) return 0;
  return 8.0;
}

/**
 * Group buy progress calculation
 */
export function calculateGroupProgress(currentCount: number, targetCount: number) {
  const safeTarget = Math.max(1, targetCount);
  const safeCurrent = Math.max(0, Math.min(currentCount, safeTarget));
  const percent = Math.min(100, Math.round((safeCurrent / safeTarget) * 100));
  const remaining = safeTarget - safeCurrent;
  const isFull = remaining <= 0;

  let statusLabel = '拼单中';
  if (isFull) {
    statusLabel = '已成团';
  } else if (remaining === 1) {
    statusLabel = '仅差1人成团';
  } else {
    statusLabel = `差${remaining}份成团`;
  }

  return {
    percent,
    remaining,
    isFull,
    statusLabel,
  };
}

/**
 * Full checkout total breakdown calculation
 */
export function calculateCheckoutTotals(
  items: CartItem[],
  deliveryMethod: 'pickup' | 'delivery',
  appliedCouponDiscount = 0
): OrderPricingBreakdown {
  const itemsSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const roundedSubtotal = Math.round(itemsSubtotal * 100) / 100;

  const hasCold = items.some((item) => item.requiresColdChain);
  const proxyFee = calculateProxyFee(roundedSubtotal);
  const packagingFee = calculatePackagingFee(hasCold, roundedSubtotal);
  const deliveryFee = calculateDeliveryFee(deliveryMethod, roundedSubtotal);
  
  const discount = Math.min(appliedCouponDiscount, roundedSubtotal);
  const total = Math.max(0, roundedSubtotal + proxyFee + packagingFee + deliveryFee - discount);

  return {
    itemsSubtotal: roundedSubtotal,
    proxyFee,
    packagingFee,
    deliveryFee,
    discount,
    totalPayable: Math.round(total * 100) / 100,
  };
}

/**
 * Formats Chinese Yuan with 2 decimal places or clean representation
 */
export function formatRMB(amount: number): string {
  if (Number.isInteger(amount)) {
    return `¥${amount}`;
  }
  return `¥${amount.toFixed(amount % 1 === 0 ? 0 : amount * 10 % 1 === 0 ? 1 : 2)}`;
}

/**
 * Filter orders by high-level category
 */
export function filterOrdersByStatus(
  orders: { status: string }[],
  filter: 'all' | 'active' | 'completed'
) {
  if (filter === 'all') return orders;
  if (filter === 'active') {
    return orders.filter((o) => o.status === 'paid' || o.status === 'purchasing' || o.status === 'portioning' || o.status === 'ready_for_pickup');
  }
  if (filter === 'completed') {
    return orders.filter((o) => o.status === 'completed');
  }
  return orders;
}

/**
 * Maps raw order status to user-facing badge configuration
 */
export function getOrderStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return { label: '已支付·待截单', variant: 'blue' };
    case 'purchasing':
      return { label: '团长采购中', variant: 'amber' };
    case 'portioning':
      return { label: '分装消杀中', variant: 'indigo' };
    case 'ready_for_pickup':
      return { label: '待自提', variant: 'emerald' };
    case 'completed':
      return { label: '已完成', variant: 'slate' };
    default:
      return { label: '处理中', variant: 'slate' };
  }
}
