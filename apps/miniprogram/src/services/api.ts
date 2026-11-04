import Taro from '@tarojs/taro';
import type { Product, SplitGroup, OrderRecord } from '../types';

// Simulator default. A physical phone needs the Mac LAN address or an HTTPS API domain.
const DEFAULT_BASE_URL = process.env.TARO_APP_API_BASE_URL || 'http://127.0.0.1:8787/api';
const buildTarget = process.env.SAM_BUILD_TARGET || 'development';
const apiBase = () => ['uat','cloud'].includes(buildTarget) ? DEFAULT_BASE_URL : Taro.getStorageSync('sam.apiBaseUrl') || DEFAULT_BASE_URL;
const tokenKey = () => `sam.customer.session:${apiBase()}`;
export class ApiError extends Error { constructor(message: string, public code: string, public status: number) { super(message); } }
export function formatBeijingDate(value: string): string {
  const date = new Date(Date.parse(value) + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
export const api = {
  baseUrl: apiBase,
  cartKey: () => `sam.cart.v3:${apiBase()}`,
  hasSession: () => Boolean(Taro.getStorageSync(tokenKey())),
  async request(path: string, method: 'GET' | 'POST' | 'PATCH', data?: any): Promise<any> {
    const token = Taro.getStorageSync(tokenKey());
    const response = await Taro.request({ url: `${this.baseUrl()}${path}`, method, data,
      header: { ...(data !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, timeout: 15000 });
    const body = response.data as any;
    if (response.statusCode === 401) Taro.removeStorageSync(tokenKey());
    if (response.statusCode >= 400 || body?.error) throw new ApiError(body?.error?.message || `请求失败 ${response.statusCode}`, body?.error?.code || 'REQUEST_FAILED', response.statusCode);
    const value = body?.data ?? body;
    if (path === '/config' && buildTarget === 'uat' && value?.uatEnabled !== true) throw new ApiError('测试服务配置不匹配，请联系管理员', 'ENVIRONMENT_MISMATCH', 503);
    if (path === '/config' && buildTarget === 'cloud' && value?.uatEnabled === true) throw new ApiError('服务配置不匹配，请联系管理员', 'ENVIRONMENT_MISMATCH', 503);
    return value;
  },
  async validSession() {
    if (!this.hasSession()) return false;
    try { await this.get('/me'); return true; } catch (e: any) { if (e.status === 401) return false; throw e; }
  },
  async privateImage(id: string) {
    const response = await Taro.downloadFile({ url: `${this.baseUrl()}/media/${encodeURIComponent(id)}`, header: { Authorization: `Bearer ${Taro.getStorageSync(tokenKey())}` } });
    if (response.statusCode !== 200) throw new Error('凭证加载失败或无权访问');
    return response.tempFilePath;
  },
  get(path: string) { return this.request(path, 'GET'); },
  post(path: string, data?: any) { return this.request(path, 'POST', data === undefined ? {} : data); },
  async wechatLogin() {
    const { code } = await Taro.login();
    const result = await this.post('/auth/wechat', { code });
    Taro.setStorageSync(tokenKey(), result.token); return result;
  },
  async devLogin() {
    const result = await this.post('/auth/dev-login', { role: 'customer', customerKey: 'miniapp-demo', nickname: '烟台体验用户' });
    Taro.setStorageSync(tokenKey(), result.token); return result;
  },
};
export function availableQuantity(p: any, option: any): number {
  if (p.inventoryNeedsReview) return 0;
  return p.inventoryScale > 0 && Number.isSafeInteger(p.inventoryUnits) ? Math.max(0, Math.floor(p.inventoryUnits / (p.inventoryScale / option.slots))) : Math.max(0,p.stock || 0);
}
export function adaptProduct(p: any): Product {
  return { ...p, bannerBadge: p.inventoryNeedsReview ? '库存待复核' : p.bannerBadge, originalPrice: p.originalPriceCents / 100,
    splitOptions: p.options.map((o: any) => ({ ...o, price: o.priceCents / 100 })) };
}
export function adaptGroup(g: any): SplitGroup {
  return { ...g, joinedCount: g.paidSlots, pricePerSlot: g.pricePerSlotCents / 100,
    remainingSeconds: Math.max(0, Math.floor((Date.parse(g.cutoffAt) - Date.now()) / 1000)),
    expiresAt: g.cutoffAt, slotDescription: g.note ? `${g.slotDescription} · ${g.note}` : g.slotDescription, category: '邻里拼份', requiresColdChain: false,
    participants: g.participants.map((p: any, i: number) => ({ ...p, id: p.id || `${g.id}-${i}`, avatar: '👤', portionName: g.slotDescription,
      joinedAt: p.paidAt, isLeader: i === 0 })) };
}
export function adaptOrder(o: any, catalog: any): OrderRecord {
  const c = o.communitySnapshot || catalog.communities.find((c: any) => c.id === o.communityId);
  const batch = o.batchSnapshot || catalog.batches.find((b: any) => b.id === o.batchId);
  const pricing = o.finalPricing || o.pricing;
  return { ...o, raw: o, orderId: o.id, batchId: batch?.title || o.batchId,
    createdAt: formatBeijingDate(o.createdAt), deliveryMethod: o.fulfillment,
    pickupStation: c?.station || '', deliveryAddress: o.address,
    items: o.items.map((i: any, n: number) => ({ ...i, id: `${o.id}-${n}`, unitPrice: i.unitPriceCents / 100 })),
    subtotal: pricing.subtotalCents / 100, proxyFee: pricing.proxyFeeCents / 100,
    packagingFee: pricing.packagingFeeCents / 100, deliveryFee: pricing.deliveryFeeCents / 100,
    discount: pricing.discountCents / 100, totalPaid: o.paidCents / 100, pickupCode: o.pickupCode || '',
  } as any;
}
