/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Taro, { useLoad, useShareAppMessage, useDidShow } from '@tarojs/taro';
import { View, Text, Button, Input } from '../../components/ui';
import { api, adaptProduct, adaptGroup, adaptOrder } from '../../services/api';
import { CATEGORIES } from '../../data/mockData';
import { Product, SplitOption, SplitGroup, ShoppingMilestone, OrderRecord } from '../../types';
import { CartItem, calculateCheckoutTotals, formatRMB } from '../../utils/orderCalculations';
import { WeChatCapsule } from '../../components/WeChatCapsule';
import { ProductCard } from '../../components/ProductCard';
import { SplitGroupCard } from '../../components/SplitGroupCard';
import { ProductDetailModal } from '../../components/ProductDetailModal';
import { CartDrawer } from '../../components/CartDrawer';
import { CheckoutModal } from '../../components/CheckoutModal';
import { WeChatPayModal } from '../../components/WeChatPayModal';
import { LiveTrackerView } from '../../components/LiveTrackerView';
import { OrderHistoryView } from '../../components/OrderHistoryView';
import { AfterSalesModal } from '../../components/AfterSalesModal';
import { ReceiptModal } from '../../components/ReceiptModal';
import { PickupQrModal } from '../../components/PickupQrModal';
import { NewSplitModal } from '../../components/NewSplitModal';
import { WeChatShareModal } from '../../components/WeChatShareModal';
import { BottomNavBar, NavTab } from '../../components/BottomNavBar';
import {
  Search,
  Sparkles,
  Flame,
  Users,
  ShieldCheck,
  ChevronRight,
  Filter,
  SlidersHorizontal,
  Smartphone,
  Monitor,
  CheckCircle2,
  Clock,
  PlusCircle,
  Truck,
  ClipboardList,
  Code2,
} from '../../components/Icons';

export default function App() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const isMobileFrame = true;
  const [currentCommunity, setCurrentCommunity] = useState('选择烟台社区');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterSplitOnly, setFilterSplitOnly] = useState(false);

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([]);
  const [milestones, setMilestones] = useState<ShoppingMilestone[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [detailWhole, setDetailWhole] = useState(false);
  // Modal states
  const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isWeChatPayOpen, setIsWeChatPayOpen] = useState(false);
  const [isNewSplitOpen, setIsNewSplitOpen] = useState(false);
  const [selectedShareGroup, setSelectedShareGroup] = useState<SplitGroup | null>(null);

  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<OrderRecord | null>(null);
  const [selectedQrOrder, setSelectedQrOrder] = useState<OrderRecord | null>(null);
  const [catalog, setCatalog] = useState<any>({ merchants: [], communities: [], batches: [], groups: [] });
  const [merchantId, setMerchantId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [wallet, setWallet] = useState<any>({ balanceCents: 0, entries: [] });
  const [config, setConfig] = useState<any>({});
  const [viewer, setViewer] = useState<any>(null);
  const [selectedTrackerOrder, setSelectedTrackerOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [optionSheet, setOptionSheet] = useState<any>(null);
  const [optionSearch, setOptionSearch] = useState('');
  const selectFrom = (title:string, items:string[]):Promise<number|undefined> => new Promise(resolve=>{setOptionSearch('');setOptionSheet({title,items,resolve});});
  const finishSelection = (index?:number) => {optionSheet?.resolve(index);setOptionSheet(null);};
  const [serviceOrder, setServiceOrder] = useState<any>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [batchId, setBatchId] = useState('');
  const submitLock = useRef(false);
  const pendingCartOrderId = useRef('');
  const pendingCartFingerprint = useRef('');
  const cartFingerprint = (items:CartItem[], selected:any) => JSON.stringify({merchantId:selected.merchantId,communityId:selected.communityId,batchId:selected.batchId,items});
  const checkoutAttempt = useRef<{fingerprint:string;requestId:string} | null>(null);
  const refreshVersion = useRef(0);
  const cartLoaded = useRef(false);
  const cartRef = useRef(cartItems); cartRef.current = cartItems;
  const selection = useRef({merchantId:'',communityId:'',batchId:''});
  selection.current = {merchantId,communityId,batchId};

  const refresh = async (chosenMerchant?: string, chosenCommunity?: string) => {
    const version = ++refreshVersion.current;
    try {
      const [cfg, cat] = await Promise.all([api.get('/config'), api.get('/catalog')]);
      if (version !== refreshVersion.current) return;
      setConfig(cfg); setCatalog(cat);
      const saved = !cartLoaded.current ? Taro.getStorageSync(api.cartKey()) : null;
      const desired = chosenMerchant || selection.current.merchantId || saved?.merchantId;
      const mid = cat.merchants.some((m: any) => m.id === desired) ? desired : cat.merchants[0]?.id || '';
      const communities = cat.communities.filter((c: any) => c.merchantId === mid);
      const community = communities.find((c: any) => c.id === (chosenCommunity || selection.current.communityId || saved?.communityId)) || communities[0];
      const batches = cat.batches.filter((b: any) => b.merchantId === mid && b.status === 'open' && Date.parse(b.cutoffAt) > Date.now());
      const heldBatch = cartRef.current.length && mid === selection.current.merchantId ? cat.batches.find((b:any)=>b.id===selection.current.batchId) : null;
      const batch = heldBatch || batches.find((b: any) => b.id === (selection.current.batchId || saved?.batchId)) || batches[0];
      if (cartRef.current.length && selection.current.merchantId && mid !== selection.current.merchantId) setCartItems([]);
      setMerchantId(mid); setCommunityId(community?.id || ''); setCurrentCommunity(community?.name || '暂无可服务社区'); setBatchId(batch?.id || '');
      setProducts(cat.products.filter((p: any) => p.merchantId === mid).map(adaptProduct));
      setSplitGroups(cat.groups.filter((g: any) => g.merchantId === mid && g.communityId === community?.id && g.batchId === batch?.id && !['failed','completed'].includes(g.status)).map(adaptGroup));
      if (!cartLoaded.current) {
        cartLoaded.current = true;
        if (saved?.merchantId === mid && saved?.communityId === community?.id && saved?.batchId === batch?.id && Date.now() - saved.savedAt < 7*86400000 && Array.isArray(saved.items)) {
          setCartItems(saved.items.filter((i: any) => Number.isInteger(i.quantity) && i.quantity > 0 && cat.products.some((p: any) => p.id === i.productId && p.merchantId === mid)));
        }
      }
      if (api.hasSession()) {
        try {
          const [list, balance, me] = await Promise.all([api.get('/orders'), api.get('/wallet'), api.get('/me')]);
          if (version !== refreshVersion.current) return;
          setOrders(list.map((o: any) => adaptOrder(o, cat))); setWallet(balance); setViewer(me);
        } catch (e: any) { if (e.status === 401) { setOrders([]); setViewer(null); setWallet({balanceCents:0,entries:[]}); setSelectedReceiptOrder(null); setSelectedQrOrder(null); setServiceOrder(null); } else throw e; }
      } else { setOrders([]); setViewer(null); setWallet({balanceCents:0,entries:[]}); setSelectedReceiptOrder(null); setSelectedQrOrder(null); setServiceOrder(null); }
      setError('');
    } catch (e: any) { if (version === refreshVersion.current) setError(e.message || '连接失败，请重试'); }
  };
  const ensureSession = async () => {
    if (await api.validSession()) return true;
    if (config.wechatLoginConfigured) { await api.wechatLogin(); await refresh(); return true; }
    if (config.devAuthEnabled) {
      const result = await Taro.showModal({ title: '本地测试身份', content: '当前为开发环境，使用测试账号体验；测试金额不涉及真实资金。', confirmText: '开始测试' });
      if (result.confirm) { await api.devLogin(); await refresh(); return true; }
      return false;
    }
    await Taro.showModal({ title: '登录待接入', content: '请先配置小程序 AppID 和服务端微信登录。', showCancel: false });
    return false;
  };
  const changeMerchant = async () => {
    if (cartItems.length && !(await Taro.showModal({ title: '切换代购商', content: '切换后将清空当前代购车，是否继续？' })).confirm) return;
    const index = await selectFrom('选择代购商', catalog.merchants.map((m: any) => m.name));
    const m = index === undefined ? null : catalog.merchants[index];
    if (m) { setCartItems([]); setCommunityId(''); await refresh(m.id); }
  };
  const selectCommunity = async () => {
    if (cartItems.length && !(await Taro.showModal({ title: '切换自提社区', content: '不同社区的拼团分别计算，切换后需重新加购，是否继续？' })).confirm) return;
    const list = catalog.communities.filter((c: any) => c.merchantId === merchantId);
    if (!list.length) return;
    const index = await selectFrom('选择自提社区', list.map((c: any) => c.name));
    const c = index === undefined ? null : list[index]; if (c) { setCartItems([]); setCommunityId(c.id); setCurrentCommunity(c.name); setSplitGroups(catalog.groups.filter((g: any) => g.merchantId === merchantId && g.communityId === c.id && g.batchId === batchId && !['failed','completed'].includes(g.status)).map(adaptGroup)); }
  };
  useDidShow(() => { refresh(); });
  useEffect(() => { if (cartLoaded.current) Taro.setStorageSync(api.cartKey(), {merchantId,communityId,batchId,items:cartItems,savedAt:Date.now()}); }, [cartItems,merchantId,communityId,batchId]);
  useEffect(() => { const timer = setInterval(() => refresh(), 30000); return () => clearInterval(timer); }, [merchantId,communityId,batchId]);
  useLoad((query) => { if (query.groupId) api.get('/catalog').then((cat: any) => { const group = cat.groups.find((g: any) => g.id === query.groupId); if (group) { selection.current={merchantId:group.merchantId,communityId:group.communityId,batchId:group.batchId}; refresh(group.merchantId, group.communityId); setSelectedShareGroup(adaptGroup(group)); } }); });
  useShareAppMessage((event: any) => {
    const group = selectedShareGroup || splitGroups.find((g) => g.id === event?.target?.dataset?.groupId);
    return { title: group ? `${group.productName} · 一起拼份` : '山姆邻里拼 · 烟台同城代购', path: `/pages/index/index${group ? '?groupId=' + group.id : ''}` };
  });

  // Reorder items from past order
  const handleReorder = async (order: OrderRecord) => {
    const mid = order.raw?.merchantId || merchantId;
    if (cartItems.length && !(await Taro.showModal({ title: '再次加购', content: '将使用当前在售规格建立新的代购车，是否继续？' })).confirm) return;
    const currentProducts = catalog.products.filter((p: any) => p.merchantId === mid).map(adaptProduct);
    const newItems: CartItem[] = [];
    for (const it of order.items) {
      const prod = currentProducts.find((p: any) => p.id === it.productId);
      const opt = prod?.splitOptions?.find((o: any) => o.id === (it as any).optionId || o.name === it.optionName);
      if (!prod || !opt) { Taro.showToast({ title: '部分商品已下架或规格已调整', icon: 'none' }); continue; }
      newItems.push({ id: `cart-${it.productId}-${opt.id}`, productId: prod.id, name: prod.name,
        originalPrice: prod.originalPrice, selectedOption: opt, unitPrice: opt.price, quantity: it.quantity,
        requiresColdChain: prod.requiresColdChain, isGroupBuy: opt.ratio < 1 });
    }
    if (!newItems.length) return;
    await refresh(mid); setCartItems(newItems); setIsCartOpen(true);
  };

  // Cart Handlers
  const handleAddToCart = (
    product: Product,
    option: SplitOption,
    quantity: number,
    isGroupBuy: boolean,
    groupId?: string
  ) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.productId === product.id && it.selectedOption.id === option.id && it.groupId === groupId
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {...copy[existingIdx], quantity: Math.min(copy[existingIdx].quantity + quantity, option.slots > 1 ? option.slots : 100)};
        return copy;
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random()}`,
          productId: product.id,
          name: product.name,
          originalPrice: product.originalPrice,
          selectedOption: option,
          unitPrice: option.price,
          quantity,
          requiresColdChain: product.requiresColdChain,
          isGroupBuy,
          groupId,
        },
      ];
    });
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const nextQ = Math.min(it.quantity + delta, it.selectedOption.slots > 1 ? it.selectedOption.slots : 100);
            return nextQ > 0 ? { ...it, quantity: nextQ } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleJoinSplitGroup = (group: SplitGroup) => {
    const raw = catalog.groups.find((g: any) => g.id === group.id);
    const product = products.find((p) => p.id === group.productId);
    const option = raw?.optionSnapshot ? {...raw.optionSnapshot,price:raw.pricePerSlotCents/100} : product?.splitOptions?.find((o) => o.id === raw?.optionId);
    if (!product || !option || !raw || raw.status !== 'recruiting' || raw.merchantId !== merchantId || raw.communityId !== communityId || raw.batchId !== batchId || Date.parse(raw.cutoffAt) <= Date.now()) { Taro.showToast({ title: '拼单已结束，请刷新', icon: 'none' }); return; }
    handleAddToCart(product, option, 1, true, group.id); setIsCartOpen(true);
  };
  const handleCreateNewGroup = async (data: any) => {
    try {
      if (!await ensureSession()) return;
      const product = products.find((p) => p.id === data.productId);
      const option = product?.splitOptions?.find((o) => o.slots === data.totalSlots && o.ratio < 1);
      const batch = catalog.batches.find((b: any) => b.id === batchId && b.status === 'open' && Date.parse(b.cutoffAt) > Date.now());
      if (!option || !batch || !communityId) throw new Error('请选择有效规格、采购批次及社区');
      const group = await api.post('/groups', { productId: data.productId, optionId: option.id, batchId: batch.id, communityId, note: data.slotDescription });
      await refresh(); setActiveTab('splits');
      handleAddToCart(product!, option, 1, true, group.id); setIsCartOpen(true);
    } catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); }
  };

  // Checkout Handlers
  const handleProceedCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmPay = async (orderData: any) => {
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      if (!await ensureSession()) return;
      setBusy(true);
      const batch = catalog.batches.find((b: any) => b.id === batchId && b.status === 'open' && Date.parse(b.cutoffAt) > Date.now());
      if (!batch || !communityId) throw new Error('当前没有可下单的采购批次');
      const input = { merchantId, batchId: batch.id, communityId, fulfillment: orderData.deliveryMethod,
        items: cartItems.map((c) => ({ productId: c.productId, optionId: c.selectedOption.id, quantity: c.quantity, ...(c.groupId ? { groupId: c.groupId } : {}) })),
        recipientName: orderData.recipientName, recipientPhone: orderData.recipientPhone, address: orderData.address, notes: orderData.notes };
      const quote = await api.post('/orders/quote', input);
      const localTotal = calculateCheckoutTotals(cartItems, orderData.deliveryMethod).totalPayable;
      if (Math.round(localTotal * 100) !== quote.totalCents && quote.pricing?.totalCents !== Math.round(localTotal * 100)) {
        const actual = (quote.totalCents ?? quote.pricing?.totalCents ?? 0) / 100;
        const ok = await Taro.showModal({ title: '以服务端核价为准', content: `本次应付 ¥${actual.toFixed(2)}，是否继续？` }); if (!ok.confirm) return;
      }
      const fingerprint = JSON.stringify(input);
      if (checkoutAttempt.current?.fingerprint !== fingerprint) checkoutAttempt.current = {fingerprint,requestId:`checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`};
      const order = await api.post('/orders', {...input, requestId: checkoutAttempt.current.requestId});
      pendingCartOrderId.current = order.id;
      pendingCartFingerprint.current = cartFingerprint(cartItems,{merchantId,communityId,batchId});
      setPendingOrder(order); setIsCheckoutOpen(false); setIsWeChatPayOpen(true); await refresh();
    } catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); }
    finally { submitLock.current = false; setBusy(false); }
  };
  const handlePaymentSuccess = async (method: 'dev' | 'test' | 'wallet' | 'wechat') => {
    if (!pendingOrder || submitLock.current) return;
    submitLock.current = true;
    try {
      setBusy(true); await api.post(`/orders/${pendingOrder.id}/pay`, { method });
      setIsWeChatPayOpen(false); if (pendingCartOrderId.current === pendingOrder.id && pendingCartFingerprint.current === cartFingerprint(cartRef.current,selection.current)) { setCartItems([]); checkoutAttempt.current=null; } setPendingOrder(null); await refresh(); setActiveTab('history');
      Taro.showToast({ title: ['dev','test'].includes(method) ? '测试付款完成' : '支付完成', icon: 'success' });
    } catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); }
    finally { submitLock.current = false; setBusy(false); }
  };
  const handleAdvanceMilestone = () => {};

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSplit = !filterSplitOnly || p.canSplit;
    return matchesCategory && matchesSearch && matchesSplit;
  });

  const cartTotalCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <View className="min-h-screen bg-slate-50 font-sans text-slate-800" style={{ '--status-height': `${Taro.getWindowInfo?.().statusBarHeight || 20}px` } as any}>
      <View className="w-full bg-white relative">
        {/* WeChat Mini Program Top Capsule Header */}
        <WeChatCapsule
          currentCommunity={currentCommunity}
          onSelectCommunity={() => selectCommunity().catch(() => {})}
          cartCount={cartTotalCount}
          onOpenCart={() => setIsCartOpen(true)}
        />

        <View className="bg-white px-3 py-2 flex items-center justify-between border-b border-slate-100 text-xs">
          <Button className="text-[#0055A5] font-bold" onClick={() => changeMerchant().catch(() => {})}>{catalog.merchants.find((m: any) => m.id === merchantId)?.name || '暂无入驻代购商'} ▾</Button>
          <Button className="text-slate-500" onClick={async () => { if (await ensureSession()) { await refresh(); setShowWallet(true); } }}>余额 ¥{(wallet.balanceCents / 100).toFixed(2)}</Button>
        </View>
        <View className="px-3 py-2 bg-blue-50 text-xs text-[#0055A5]" onClick={async () => {
          const available = catalog.batches.filter((b: any) => b.merchantId === merchantId && b.status === 'open' && Date.parse(b.cutoffAt) > Date.now());
          if (!available.length) return;
          if (cartItems.length && !(await Taro.showModal({title:'切换采购批次',content:'切换后需重新加购，是否继续？'})).confirm) return;
          try { const index = await selectFrom('选择采购批次',available.map((b:any)=>b.title)); if(index===undefined)return; const batch=available[index]; setCartItems([]); setBatchId(batch.id); setSplitGroups(catalog.groups.filter((g:any)=>g.merchantId===merchantId&&g.communityId===communityId&&g.batchId===batch.id&&g.status!=='failed').map(adaptGroup)); } catch {}
        }}>采购批次：{catalog.batches.find((b:any)=>b.id===batchId)?.title || '暂无开放批次'} ▾</View>
        {config.uatEnabled && <View className="bg-amber-50 text-amber-900 px-3 py-2 text-xs space-y-1">
          <View className="font-bold">线上测试环境 · 无真实付款与配送</View>
          {viewer ? <View className="flex justify-between items-center"><Text>{config.testPaymentsEnabled ? '测试资格已开通' : '等待管理员开通测试资格'}</Text><Button className="text-xs text-[#0055A5]" onClick={()=>Taro.setClipboardData({data:viewer.id})}>复制我的测试编号</Button></View> : <Button className="text-xs text-[#0055A5] text-left" onClick={async()=>{try{await ensureSession();}catch(e:any){Taro.showToast({title:e.message,icon:'none'});}}}>微信登录，登记测试账号</Button>}
        </View>}
        {config.devAuthEnabled && <View className="bg-amber-50 text-amber-800 px-3 py-1 text-[0.625rem]">本地开发环境 · 测试订单与余额不涉及真实资金</View>}
        {error && <View className="bg-red-50 text-red-700 p-3 text-xs" onClick={() => refresh()}>连接失败：{error} · 点击重试</View>}
        {/* Global Search & Filter Bar */}
        <View className="p-3 bg-white border-b border-slate-100 flex items-center gap-2">
          <View className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索山姆大包装: 瑞士卷 / 烤鸡 / 牛排 / 小青柠..."
              className="w-full text-xs pl-9 pr-8 py-2 bg-slate-100 rounded-full border border-transparent focus:border-[#0055A5] focus:bg-white focus:outline-none transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <Button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center"
              >
                ×
              </Button>
            )}
          </View>

          <Button
            onClick={() => setFilterSplitOnly(!filterSplitOnly)}
            className={`px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 transition-all ${
              filterSplitOnly
                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="仅看支持分装拼单的商品"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <Text>仅可拼单</Text>
          </Button>
        </View>

        {/* Content Tabs Area */}
        <View className="min-h-[36.25rem] bg-slate-50/60 p-3 pb-24">
          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <View className="space-y-4 text-left">
              {/* Campaign Hero Banner */}
              <View className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0055A5] to-[#0072CE] p-4 text-white shadow-md">
                <View className="relative z-10 space-y-2">
                  <View className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded-full text-[0.625rem]">
                    <Sparkles className="w-3 h-3 text-amber-900" />
                    <Text>烟台同城 · 会员专职代购专班</Text>
                  </View>

                  <View className="text-lg sm:text-xl font-bold leading-tight">
                    山姆大包装不用愁，邻里拆包拼着买
                  </View>

                  <View className="text-xs text-blue-100 leading-relaxed max-w-sm">
                    原装整箱太沉吃不完？我们提供按采购批次统一代购、按规格分装，采购小票与履约进度可查。
                  </View>

                  {/* Dispatch Counter & Action */}
                  <View className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 text-xs">
                    <View className="flex items-center gap-1.5 text-amber-200 font-medium text-[0.6875rem]">
                      <Clock className="w-3.5 h-3.5" />
                      <Text>{catalog.batches.find((b: any) => b.id === batchId)?.title || '查看采购批次'}</Text>
                    </View>

                    <Button
                      onClick={() => setIsNewSplitOpen(true)}
                      className="bg-white hover:bg-amber-50 text-[#0055A5] px-3 py-1.5 rounded-full font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
                      <Text>我要发起拼单</Text>
                    </Button>
                  </View>
                </View>
              </View>

              {/* 4 Feature Badges */}
              <View className="grid grid-cols-4 gap-2 text-center">
                <View
                  onClick={() => {
                    setSelectedCategory('bakery');
                    setActiveTab('category');
                  }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <Text className="text-xl">🍰</Text>
                  <Text className="text-[0.6875rem] font-bold text-slate-800 mt-1">烘焙热拼</Text>
                  <Text className="text-[0.5625rem] text-amber-600">瑞士卷/麻薯</Text>
                </View>

                <View
                  onClick={() => {
                    setSelectedCategory('fresh');
                    setActiveTab('category');
                  }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <Text className="text-xl">🥩</Text>
                  <Text className="text-[0.6875rem] font-bold text-slate-800 mt-1">生鲜原切</Text>
                  <Text className="text-[0.5625rem] text-rose-600">牛排/三文鱼</Text>
                </View>

                <View
                  onClick={() => setActiveTab('splits')}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <Text className="text-xl">👥</Text>
                  <Text className="text-[0.6875rem] font-bold text-slate-800 mt-1">拼单广场</Text>
                  <Text className="text-[0.5625rem] text-blue-600">差1人锁单</Text>
                </View>

                <View
                  onClick={() => setActiveTab('tracker')}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <Text className="text-xl">🧾</Text>
                  <Text className="text-[0.6875rem] font-bold text-slate-800 mt-1">小票核验</Text>
                  <Text className="text-[0.5625rem] text-emerald-600">原价透明</Text>
                </View>
              </View>

              {/* Hot Group Buys Section */}
              <View className="space-y-2.5">
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <View className="font-bold text-slate-900 text-sm">
                      邻里正在拼 · 差1人即刻锁单
                    </View>
                  </View>

                  <Button
                    onClick={() => setActiveTab('splits')}
                    className="text-xs text-[#0055A5] font-semibold flex items-center hover:underline"
                  >
                    <Text>查看全部房间</Text>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </View>

                <View
                  className={`grid gap-3 ${
                    isMobileFrame ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
                  }`}
                >
                  {splitGroups.slice(0, 2).map((group) => (
                    <SplitGroupCard
                      key={group.id}
                      group={group}
                      onJoin={handleJoinSplitGroup}
                      onShare={(g) => setSelectedShareGroup(g)}
                    />
                  ))}
                </View>
              </View>

              {/* Popular Products Split / Buy Grid */}
              <View className="space-y-2.5 pt-2">
                <View className="flex items-center justify-between">
                  <View className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Text>山姆大包装拆分选购</Text>
                    <Text className="text-[0.625rem] text-slate-400 font-normal">
                      (支持拼半份或整盒代购)
                    </Text>
                  </View>
                  <Button
                    onClick={() => setActiveTab('category')}
                    className="text-xs text-[#0055A5] font-semibold hover:underline"
                  >
                    全部商品 ▾
                  </Button>
                </View>

                <View
                  className={`grid gap-3 ${
                    isMobileFrame
                      ? 'grid-cols-2'
                      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  }`}
                >
                  {filteredProducts.slice(0, 6).map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpenDetail={(p) => { setDetailWhole(false); setActiveDetailProduct(p); }}
                      onQuickSplit={(p) => { setDetailWhole(false); setActiveDetailProduct(p); }}
                      onDirectBuy={(p) => { setDetailWhole(true); setActiveDetailProduct(p); }}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* TAB 2: CATEGORY CATALOG */}
          {activeTab === 'category' && (
            <View className="space-y-4 text-left">
              {/* Category Segmented Scroll */}
              <View className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-[#0055A5] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                    }`}
                  >
                    {cat.name}
                  </Button>
                ))}
              </View>

              {/* Product Grid */}
              <View className="space-y-2">
                <View className="flex items-center justify-between text-xs text-slate-500">
                  <Text>
                    共找到 <Text className="text-slate-900">{filteredProducts.length}</Text> 件商品
                  </Text>
                  <Text className="text-[0.6875rem] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    全单冷链包装 · 现场采购
                  </Text>
                </View>

                <View
                  className={`grid gap-3 ${
                    isMobileFrame
                      ? 'grid-cols-2'
                      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                  }`}
                >
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpenDetail={(p) => { setDetailWhole(false); setActiveDetailProduct(p); }}
                      onQuickSplit={(p) => { setDetailWhole(false); setActiveDetailProduct(p); }}
                      onDirectBuy={(p) => { setDetailWhole(true); setActiveDetailProduct(p); }}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* TAB 3: SPLITS PLAZA */}
          {activeTab === 'splits' && (
            <View className="space-y-4 text-left">
              {/* Header card with action */}
              <View className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-4 text-white shadow-md flex items-center justify-between gap-3">
                <View>
                  <View className="font-bold text-base leading-tight">邻里拼单大厅</View>
                  <View className="text-xs text-amber-100 mt-1">
                    付款计入成团份数，按代购商采购批次截单
                  </View>
                </View>

                <Button
                  onClick={() => setIsNewSplitOpen(true)}
                  className="bg-white text-orange-950 px-3.5 py-2 rounded-2xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <PlusCircle className="w-4 h-4 text-amber-600" />
                  <Text>发起新拼单</Text>
                </Button>
              </View>

              {/* Split list */}
              <View className="space-y-3">
                {splitGroups.map((group) => (
                  <SplitGroupCard
                    key={group.id}
                    group={group}
                    onJoin={handleJoinSplitGroup}
                    onShare={(g) => setSelectedShareGroup(g)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* TAB 4: TRACKER */}
          {activeTab === 'tracker' && (
            <LiveTrackerView
              orders={selectedTrackerOrder ? orders.filter(o => o.orderId === selectedTrackerOrder.orderId) : orders}
              catalog={catalog}
              merchantId={merchantId}
              milestones={milestones}
              onAdvanceMilestone={handleAdvanceMilestone}
              onResetMilestones={() => refresh()}
            />
          )}

          {/* TAB 5: ORDER HISTORY */}
          {activeTab === 'history' && !api.hasSession() && <Button className="w-full bg-blue-50 text-[#0055A5] rounded-xl py-3 mb-3 text-sm" onClick={async()=>{try{if(await ensureSession())await refresh();}catch(e:any){Taro.showToast({title:e.message,icon:'none'});}}}>登录查看我的订单</Button>}
          {activeTab === 'history' && (
            <OrderHistoryView
              orders={orders}
              onViewTracker={(order) => { setSelectedTrackerOrder(order); setActiveTab('tracker'); }}
              onViewReceipt={(order) => setSelectedReceiptOrder(order)}
              onViewQrCode={(order) => setSelectedQrOrder(order)}
              onReorder={handleReorder}
              onAfterSales={setServiceOrder}
              onCancel={async(order)=>{try{if(!(await Taro.showModal({title:'取消未付款订单',content:'确认取消此订单？'})).confirm)return;await api.post(`/orders/${order.orderId}/cancel`);checkoutAttempt.current=null;await refresh();}catch(e:any){Taro.showToast({title:e.message,icon:'none'});}}}
              onPay={(order) => { setPendingOrder(order.raw); setIsWeChatPayOpen(true); }}
              onTopup={async (order, method) => { try { await api.post(`/orders/${order.orderId}/topup`, { method }); await refresh(); } catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); } }}
              devPaymentsEnabled={Boolean(config.devPaymentsEnabled)}
              testPaymentsEnabled={Boolean(config.testPaymentsEnabled)}
              uatEnabled={Boolean(config.uatEnabled)}
            />
          )}
        </View>

        {/* WeChat Mini Program Bottom Tab Bar */}
        <BottomNavBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          cartCount={cartTotalCount}
          onOpenCart={() => setIsCartOpen(true)}
        />
      </View>

      {showWallet && <View className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setShowWallet(false)}>
        <View className="w-full bg-white rounded-t-3xl p-5 safe-bottom" onClick={(e) => e.stopPropagation()}>
          <View className="flex justify-between items-center"><Text className="font-bold">我的账户余额</Text><Button className="w-12 text-sm shrink-0" onClick={() => setShowWallet(false)}>关闭</Button></View>
          <View className="text-3xl font-bold text-[#0055A5] py-5">¥{(wallet.balanceCents / 100).toFixed(2)}</View>
          <View className="text-xs text-slate-500 mb-3">未成团和称重退差余额可用于本平台后续订单，以下为账户收支记录。</View>
          <View className="max-h-[50vh] overflow-y-auto">{wallet.entries.length === 0 ? <View className="text-xs text-slate-400">暂无收支记录</View> : wallet.entries.map((e: any) => <View key={e.id} className="py-3 border-t border-slate-100 text-xs flex justify-between"><View><View>{e.note}</View><View className="text-[0.625rem] text-slate-400">{e.createdAt}</View></View><Text className={e.amountCents > 0 ? 'text-emerald-600' : 'text-rose-600'}>{e.amountCents > 0 ? '+' : ''}¥{(e.amountCents / 100).toFixed(2)}</Text></View>)}</View>
        </View>
      </View>}
      {optionSheet && <View className="fixed inset-0 z-50 bg-black/60 flex items-end"><View className="w-full bg-white rounded-t-3xl p-5 safe-bottom space-y-3"><View className="font-bold flex justify-between"><Text>{optionSheet.title}</Text><Button className="w-12 text-sm shrink-0" onClick={()=>finishSelection()}>取消</Button></View>{optionSheet.items.length>6&&<Input value={optionSearch} onChange={(e:any)=>setOptionSearch(e.target.value)} className="w-full rounded-xl bg-slate-100 p-3 text-sm" placeholder="输入名称搜索"/>}<View className="max-h-[60vh] overflow-y-auto">{optionSheet.items.map((name:string,index:number)=>name.includes(optionSearch)&&<Button key={index} className="w-full text-left py-3 border-b border-slate-100 text-sm text-[#0055A5]" onClick={()=>finishSelection(index)}>{name}</Button>)}</View></View></View>}
      <AfterSalesModal order={serviceOrder} onClose={()=>setServiceOrder(null)} />
      {/* Floating Modals and Sheets */}
      <ProductDetailModal
        product={activeDetailProduct}
        initialWhole={detailWhole}
        onClose={() => setActiveDetailProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onProceedCheckout={handleProceedCheckout}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        currentCommunity={currentCommunity}
        pickupStation={catalog.communities.find((c: any) => c.id === communityId)?.station}
        batch={catalog.batches.find((b: any) => b.id === batchId)}
        onConfirmPay={handleConfirmPay}
        busy={busy}
      />

      <WeChatPayModal
        isOpen={isWeChatPayOpen}
        onClose={() => { if(!busy)setIsWeChatPayOpen(false); }}
        amount={(pendingOrder?.pricing?.totalCents || 0) / 100}
        walletBalance={wallet.balanceCents / 100}
        devPaymentsEnabled={Boolean(config.devPaymentsEnabled)}
        testPaymentsEnabled={Boolean(config.testPaymentsEnabled)}
        uatEnabled={Boolean(config.uatEnabled)}
        wechatPaymentEnabled={Boolean(config.wechatPaymentEnabled)}
        onRefresh={()=>refresh()}
        busy={busy}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <NewSplitModal
        isOpen={isNewSplitOpen}
        onClose={() => setIsNewSplitOpen(false)}
        products={products}
        onCreateGroup={handleCreateNewGroup}
      />

      {/* Shared Order Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedReceiptOrder)}
        onClose={() => setSelectedReceiptOrder(null)}
        order={selectedReceiptOrder}
      />

      {/* Shared Order Pickup QR Code Modal */}
      <PickupQrModal
        isOpen={Boolean(selectedQrOrder)}
        onClose={() => setSelectedQrOrder(null)}
        order={selectedQrOrder}
      />

      {/* WeChat Mini Program Share Card Preview Modal */}
      <WeChatShareModal
        group={selectedShareGroup}
        product={products.find((p) => p.id === selectedShareGroup?.productId)}
        currentCommunity={currentCommunity}
        onClose={() => setSelectedShareGroup(null)}
        onJoin={handleJoinSplitGroup}
      />


    </View>
  );
}
