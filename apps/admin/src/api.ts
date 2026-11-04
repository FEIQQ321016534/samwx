export type Role = "admin" | "merchant";
export interface User {
  id: string;
  role: Role;
  merchantId?: string;
  nickname?: string;
}
export interface Session {
  token: string;
  user: User;
  development?: boolean;
  expiresAt?: string;
  apiUrl?: string;
}
export interface Merchant {
  id: string;
  name: string;
  status: string;
  contactName?: string;
  contactPhone?: string;
  city?: string;
  reviewReason?: string;
  reason?: string;
  createdAt?: string;
}
export interface SplitOption {
  id: string;
  name: string;
  ratio: number;
  slots: number;
  weightEstimate: string;
  priceCents: number;
  description: string;
}
export interface Product {
  id: string;
  merchantId: string;
  name: string;
  categoryId: string;
  originalPriceCents: number;
  originalSpecs: string;
  canSplit: boolean;
  requiresColdChain: boolean;
  stock: number;
  options: SplitOption[];
  tags: string[];
  iconType: string;
  accentColor: string;
  active?: boolean;
  subtitle?: string;
  inventoryUnits?: number;
  inventoryScale?: number;
  inventoryNeedsReview?: boolean;
  version?: number;
}
export interface Batch {
  id: string;
  merchantId: string;
  title: string;
  storeName: string;
  cutoffAt: string;
  pickupStartAt: string;
  pickupEndAt: string;
  status: string;
  closedAt?: string;
  shopperName?: string;
  shopperPhone?: string;
  note?: string;
}
export interface OrderItem {
  id?: string;
  cancelledQuantity?: number;
  settlementGoodsCents?: number;
  productId: string;
  name?: string;
  productName?: string;
  optionId?: string;
  optionName?: string;
  quantity: number;
  unitPriceCents?: number;
  priceCents?: number;
  groupId?: string;
  state?: string;
}
export interface Pricing {
  itemsSubtotalCents?: number;
  goodsCents?: number;
  subtotalCents?: number;
  proxyFeeCents?: number;
  packagingFeeCents?: number;
  deliveryFeeCents?: number;
  totalCents?: number;
  totalPayableCents?: number;
}
export interface Progress {
  status?: string;
  note?: string;
  photoUrls?: string[];
  receiptUrls?: string[];
  createdAt?: string;
  at?: string;
}
export interface Order {
  id: string;
  orderId?: string;
  financialStatus?: string;
  afterSalesCreditCents?: number;
  refunds?: {
    id: string;
    requestId: string;
    type: string;
    amountCents: number;
    reason: string;
    createdAt: string;
  }[];
  merchantSnapshot?: { name: string };
  communitySnapshot?: { name: string; station: string; address: string };
  batchSnapshot?: { title: string };
  customerId?: string;
  userId?: string;
  merchantId: string;
  batchId: string;
  status: string;
  fulfillment: string;
  communityId?: string;
  recipientName?: string;
  recipientPhone?: string;
  address?: string;
  notes?: string;
  items: OrderItem[];
  pricing?: Pricing;
  finalPricing?: Pricing;
  quote?: Pricing;
  totals?: Pricing;
  totalCents?: number;
  totalPaidCents?: number;
  paidCents?: number;
  refundedCents?: number;
  pickupCode?: string;
  createdAt: string;
  progress?: Progress[];
  timeline?: Progress[];
  photoUrls?: string[];
  receiptUrls?: string[];
  topupCents?: number;
  weightAdjustmentCents?: number;
  weightAdjustments?: {
    adjustmentId: string;
    actualGoodsCents: number;
    deltaCents: number;
    note: string;
    at: string;
  }[];
  adjustments?: {
    id?: string;
    note?: string;
    deltaCents?: number;
    actualGoodsCents?: number;
    createdAt?: string;
  }[];
}
export interface WalletEntry {
  id: string;
  type?: string;
  kind?: string;
  amountCents: number;
  balanceAfterCents?: number;
  balanceCents?: number;
  note?: string;
  description?: string;
  orderId?: string;
  createdAt?: string;
}
export interface Wallet {
  balanceCents: number;
  entries: WalletEntry[];
}
export interface Overview {
  merchants: number;
  products: number;
  batches: number;
  orders: number;
  revenueCents: number;
  pendingReviews: number;
}
export interface Catalog {
  merchants: Merchant[];
  communities: { id: string; name: string }[];
  batches: Batch[];
  products: Product[];
}
export interface PaymentConfig {
  devPaymentsEnabled?: boolean;
  wechatPayConfigured?: boolean;
  devLoginEnabled?: boolean;
  devAuthEnabled?: boolean;
  managementAuthEnabled?: boolean;
  uatEnabled?: boolean;
}
export const isUatBuild = import.meta.env.BASE_URL === "/uat/";
export const defaultApiUrl =
  import.meta.env.VITE_API_URL ||
  (isUatBuild ? "/uat/api" : "http://localhost:8787/api");
export function cleanUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}
export async function request<T>(
  base: string,
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const apiUrl = cleanUrl(base);
  if (isUatBuild && apiUrl !== "/uat/api") {
    throw new Error("线上测试管理台须连接同源 /uat/api。");
  }
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(20000),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("无法连接业务服务，请确认 API 地址及服务是否启动。");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("sam:auth-expired"));
    throw new ApiError(
      response.status,
      result?.error?.code || "HTTP_ERROR",
      result?.error?.message || `请求失败（HTTP ${response.status}）`,
    );
  }
  return (result && "data" in result ? result.data : result) as T;
}
export function money(value?: number) {
  return `¥${((value || 0) / 100).toFixed(2)}`;
}
export function date(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}
export function cents(value: string) {
  const normalized = value.trim();
  if (!/^(0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(normalized))
    throw new Error("请输入最多两位小数的非负人民币金额。");
  const [whole, fraction = ""] = normalized.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000)
    throw new Error("金额不能超过100万元。");
  return result;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type {
  Community,
  AfterSalesCase,
  OperationAudit,
} from "../../../packages/domain/src/index";
export interface Reconciliation {
  orderCount: number;
  orders: {
    orderId: string;
    paidCents: number;
    refundedCents: number;
    netReceivedCents: number;
    amountDueCents: number;
    topupCents: number;
    walletPaymentCents: number;
    walletRefundCents: number;
    discrepancies: string[];
  }[];
  paidCents: number;
  refundedCents: number;
  netReceivedCents: number;
  amountDueCents: number;
  topupCents: number;
  walletRefundCents: number;
  discrepancies: { orderId: string; code: string; message: string }[];
}
