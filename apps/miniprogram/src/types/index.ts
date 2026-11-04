/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SplitOption {
  id: string;
  name: string;
  ratio: number;
  slots: number;
  weightEstimate: string;
  price: number;
  description: string;
}

export interface Product {
  inventoryUnits?: number;
  inventoryScale?: number;
  inventoryNeedsReview?: boolean;
  id: string;
  name: string;
  subtitle: string;
  categoryId: string;
  originalPrice: number;
  originalSpecs: string;
  canSplit: boolean;
  splitOptions?: SplitOption[];
  requiresColdChain: boolean;
  stock: number;
  salesCount: number;
  tags: string[];
  bannerBadge?: string;
  iconType: 'bakery' | 'meat' | 'drink' | 'snack' | 'grocery' | 'fresh';
  accentColor: string;
}

export interface GroupParticipant {
  id: string;
  nickname: string;
  avatar: string;
  portionName: string;
  joinedAt: string;
  isLeader?: boolean;
}

export interface SplitGroup {
  id: string;
  productId: string;
  productName: string;
  totalSlots: number;
  joinedCount: number;
  pricePerSlot: number;
  slotDescription: string;
  expiresAt: string; // ISO string or human string
  remainingSeconds: number;
  status: 'recruiting' | 'full' | 'purchasing' | 'completed';
  participants: GroupParticipant[];
  category: string;
  requiresColdChain: boolean;
}

export interface ShoppingMilestone {
  id: string;
  stepNumber: number;
  title: string;
  time: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  shopperNote?: string;
  hasPhoto?: boolean;
  photoType?: 'cart' | 'receipt' | 'packaging' | 'shelf';
}

export interface OrderItem {
  cancelledQuantity?: number;
  id: string;
  productId: string;
  name: string;
  optionName: string;
  quantity: number;
  unitPrice: number;
  isSplit: boolean;
  weightEstimate: string;
}

export interface OrderRecord {
  raw?: any;
  [key: string]: any;
  orderId: string;
  createdAt: string;
  batchId: string;
  status: 'unpaid' | 'paid' | 'awaiting_topup' | 'purchasing' | 'portioning' | 'ready_for_pickup' | 'delivering' | 'completed' | 'refunded' | 'cancelled';
  deliveryMethod: 'pickup' | 'delivery';
  pickupStation: string;
  deliveryAddress?: string;
  recipientName: string;
  recipientPhone: string;
  items: OrderItem[];
  subtotal: number;
  proxyFee: number;
  packagingFee: number;
  deliveryFee: number;
  discount: number;
  totalPaid: number;
  pickupCode: string;
}
