/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CATEGORIES,
  PRODUCTS,
  ACTIVE_GROUPS,
  SHOPPING_BATCH_INFO,
  SHOPPING_MILESTONES,
  INITIAL_ORDERS,
  MOCK_COMMUNITIES,
} from './data/mockData';
import { Product, SplitOption, SplitGroup, ShoppingMilestone, OrderRecord } from './types';
import { CartItem, calculateCheckoutTotals, formatRMB } from './utils/orderCalculations';
import { WeChatCapsule } from './components/WeChatCapsule';
import { ProductCard } from './components/ProductCard';
import { SplitGroupCard } from './components/SplitGroupCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { WeChatPayModal } from './components/WeChatPayModal';
import { LiveTrackerView } from './components/LiveTrackerView';
import { OrderHistoryView } from './components/OrderHistoryView';
import { ReceiptModal } from './components/ReceiptModal';
import { PickupQrModal } from './components/PickupQrModal';
import { NewSplitModal } from './components/NewSplitModal';
import { WeChatShareModal } from './components/WeChatShareModal';
import { CodeExportModal } from './components/CodeExportModal';
import { BottomNavBar, NavTab } from './components/BottomNavBar';
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
} from 'lucide-react';

export default function App() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isMobileFrame, setIsMobileFrame] = useState(true);
  const [currentCommunity, setCurrentCommunity] = useState(MOCK_COMMUNITIES[0].name);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterSplitOnly, setFilterSplitOnly] = useState(false);

  // Data States
  const [products] = useState<Product[]>(PRODUCTS);
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>(ACTIVE_GROUPS);
  const [milestones, setMilestones] = useState<ShoppingMilestone[]>(SHOPPING_MILESTONES);
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: 'cart-init-1',
      productId: 'sam-p1',
      name: 'Member\'s Mark 伯爵红茶原味瑞士卷',
      originalPrice: 68.0,
      selectedOption: {
        id: 'split-half',
        name: '拼半盒 (8片混合装)',
        ratio: 0.5,
        slots: 2,
        weightEstimate: '约600g',
        price: 34.0,
        description: '食品级环保锁鲜盒独立分装',
      },
      unitPrice: 34.0,
      quantity: 1,
      requiresColdChain: true,
      isGroupBuy: true,
    },
  ]);

  // Modal states
  const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isWeChatPayOpen, setIsWeChatPayOpen] = useState(false);
  const [isNewSplitOpen, setIsNewSplitOpen] = useState(false);
  const [selectedShareGroup, setSelectedShareGroup] = useState<SplitGroup | null>(null);
  const [isCodeExportOpen, setIsCodeExportOpen] = useState(false);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<OrderRecord | null>(null);
  const [selectedQrOrder, setSelectedQrOrder] = useState<OrderRecord | null>(null);
  const [pendingOrderData, setPendingOrderData] = useState<{
    deliveryMethod: 'pickup' | 'delivery';
    recipientName: string;
    recipientPhone: string;
    address: string;
    notes: string;
  } | null>(null);

  // Reorder items from past order
  const handleReorder = (order: OrderRecord) => {
    const newItems: CartItem[] = order.items.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      const opt: SplitOption = prod?.splitOptions?.find((o) => o.name === it.optionName) || {
        id: `opt-reorder-${it.productId}`,
        name: it.optionName,
        ratio: it.isSplit ? 0.5 : 1.0,
        slots: it.isSplit ? 2 : 1,
        weightEstimate: it.weightEstimate,
        price: it.unitPrice,
        description: '往期再次加购规格',
      };
      return {
        id: `cart-reorder-${Date.now()}-${Math.random()}`,
        productId: it.productId,
        name: it.name,
        originalPrice: prod ? prod.originalPrice : it.unitPrice,
        selectedOption: opt,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        requiresColdChain: prod?.requiresColdChain ?? true,
        isGroupBuy: it.isSplit,
      };
    });
    setCartItems((prev) => [...prev, ...newItems]);
    setIsCartOpen(true);
  };

  // Cart Handlers
  const handleAddToCart = (
    product: Product,
    option: SplitOption,
    quantity: number,
    isGroupBuy: boolean
  ) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.productId === product.id && it.selectedOption.id === option.id
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += quantity;
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
        },
      ];
    });
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const nextQ = it.quantity + delta;
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

  // Split Group Join Action
  const handleJoinSplitGroup = (group: SplitGroup) => {
    const product = products.find((p) => p.id === group.productId);
    if (!product) return;
    const option = product.splitOptions?.find((opt) => opt.ratio < 1) || {
      id: 'split-opt',
      name: group.slotDescription,
      ratio: 1 / group.totalSlots,
      slots: group.totalSlots,
      weightEstimate: '标准拼单份',
      price: group.pricePerSlot,
      description: '邻里共同分装',
    };

    handleAddToCart(product, option, 1, true);

    // Update group count
    setSplitGroups((prev) =>
      prev.map((g) => {
        if (g.id === group.id) {
          const nextCount = g.joinedCount + 1;
          return {
            ...g,
            joinedCount: nextCount,
            status: nextCount >= g.totalSlots ? 'full' : 'recruiting',
            participants: [
              ...g.participants,
              {
                id: `u-new-${Date.now()}`,
                nickname: '我 (阳光花园)',
                avatar: '🙋‍♂️',
                portionName: group.slotDescription,
                joinedAt: '刚刚',
                isLeader: false,
              },
            ],
          };
        }
        return g;
      })
    );

    setIsCartOpen(true);
  };

  // Create New Split Room
  const handleCreateNewGroup = (data: {
    productId: string;
    productName: string;
    totalSlots: number;
    pricePerSlot: number;
    slotDescription: string;
    category: string;
  }) => {
    const newGroup: SplitGroup = {
      id: `group-${Date.now()}`,
      productId: data.productId,
      productName: data.productName,
      totalSlots: data.totalSlots,
      joinedCount: 1,
      pricePerSlot: data.pricePerSlot,
      slotDescription: data.slotDescription,
      expiresAt: '2026-11-03T16:00:00Z',
      remainingSeconds: 7200,
      status: 'recruiting',
      category: data.category,
      requiresColdChain: true,
      participants: [
        {
          id: 'u-self',
          nickname: '我 (阳光花园·新团长)',
          avatar: '👑',
          portionName: data.slotDescription,
          joinedAt: '刚刚',
          isLeader: true,
        },
      ],
    };
    setSplitGroups((prev) => [newGroup, ...prev]);
    setActiveTab('splits');
  };

  // Checkout Handlers
  const handleProceedCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleConfirmPay = (orderData: {
    deliveryMethod: 'pickup' | 'delivery';
    recipientName: string;
    recipientPhone: string;
    address: string;
    notes: string;
  }) => {
    setPendingOrderData(orderData);
    setIsCheckoutOpen(false);
    setIsWeChatPayOpen(true);
  };

  // Payment Success Handler
  const handlePaymentSuccess = () => {
    setIsWeChatPayOpen(false);
    if (!pendingOrderData) return;

    const totals = calculateCheckoutTotals(cartItems, pendingOrderData.deliveryMethod, 5);
    const newOrder: OrderRecord = {
      orderId: `SAM-${Date.now().toString().slice(-8)}`,
      createdAt: '2026-11-03 13:42',
      batchId: '第1103期',
      status: 'purchasing',
      deliveryMethod: pendingOrderData.deliveryMethod,
      pickupStation:
        pendingOrderData.deliveryMethod === 'pickup'
          ? `${currentCommunity} 东区1号楼便民自提驿站 (架位 A-03)`
          : pendingOrderData.address,
      recipientName: pendingOrderData.recipientName,
      recipientPhone: pendingOrderData.recipientPhone,
      pickupCode: `SAM-${Math.floor(1000 + Math.random() * 9000)}`,
      items: cartItems.map((c, i) => ({
        id: `ord-it-${i}`,
        productId: c.productId,
        name: c.name,
        optionName: c.selectedOption.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        isSplit: c.selectedOption.ratio < 1,
        weightEstimate: c.selectedOption.weightEstimate,
      })),
      subtotal: totals.itemsSubtotal,
      proxyFee: totals.proxyFee,
      packagingFee: totals.packagingFee,
      deliveryFee: totals.deliveryFee,
      discount: totals.discount,
      totalPaid: totals.totalPayable,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCartItems([]);
    setActiveTab('tracker');
  };

  // Milestone Step Advance (testing affordance)
  const handleAdvanceMilestone = () => {
    setMilestones((prev) => {
      const currentIdx = prev.findIndex((m) => m.status === 'current');
      if (currentIdx < 0 || currentIdx >= prev.length - 1) {
        // Reset
        return prev.map((m, idx) => ({
          ...m,
          status: idx === 0 ? 'completed' : idx === 1 ? 'current' : 'pending',
        }));
      }
      return prev.map((m, idx) => {
        if (idx === currentIdx) return { ...m, status: 'completed' as const };
        if (idx === currentIdx + 1) return { ...m, status: 'current' as const };
        return m;
      });
    });
  };

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
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased flex flex-col items-center">
      {/* Top Bar with Device Preview Switcher */}
      <div className="w-full bg-slate-900 text-white px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white tracking-wide flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#07C160]"></span>
            <span>山姆邻里拼 · 微信小程序预览</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            | 全省专职代购 · 大包装分装拼单 · 小票保真
          </span>
        </div>

        {/* Device Switcher & Code Export Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setIsCodeExportOpen(true)}
            className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-xs transition-all active:scale-95"
            title="查看核心组件转换后的 Taro 与微信原生代码"
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-200" />
            <span>小程序代码 (Taro/原生)</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setIsMobileFrame(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                isMobileFrame
                  ? 'bg-[#0055A5] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="切换至微信小程序真机视窗"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>小程序视窗 (390px)</span>
            </button>
            <button
              onClick={() => setIsMobileFrame(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                !isMobileFrame
                  ? 'bg-[#0055A5] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="切换至宽屏平铺视窗"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>宽屏视图</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-300 ${
          isMobileFrame
            ? 'max-w-[420px] my-0 sm:my-4 sm:rounded-[44px] shadow-2xl overflow-hidden border-[6px] border-slate-800 bg-white relative'
            : 'max-w-6xl my-4 px-4 bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-200'
        }`}
      >
        {/* WeChat Mini Program Top Capsule Header */}
        <WeChatCapsule
          currentCommunity={currentCommunity}
          onSelectCommunity={setCurrentCommunity}
          cartCount={cartTotalCount}
          onOpenCart={() => setIsCartOpen(true)}
        />

        {/* Global Search & Filter Bar */}
        <div className="p-3 bg-white border-b border-slate-100 flex items-center gap-2">
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索山姆大包装: 瑞士卷 / 烤鸡 / 牛排 / 小青柠..."
              className="w-full text-xs pl-9 pr-8 py-2 bg-slate-100 rounded-full border border-transparent focus:border-[#0055A5] focus:bg-white focus:outline-none transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </div>

          <button
            onClick={() => setFilterSplitOnly(!filterSplitOnly)}
            className={`px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 transition-all ${
              filterSplitOnly
                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="仅看支持分装拼单的商品"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>仅可拼单</span>
          </button>
        </div>

        {/* Content Tabs Area */}
        <main className="min-h-[580px] bg-slate-50/60 p-3 sm:p-4">
          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <div className="space-y-4 text-left">
              {/* Campaign Hero Banner */}
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0055A5] to-[#0072CE] p-4 text-white shadow-md">
                <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center gap-1.5 bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded-full text-[10px]">
                    <Sparkles className="w-3 h-3 text-amber-900" />
                    <span>本省稀缺 · 会员专职代购专班</span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold leading-tight">
                    山姆大包装不用愁，邻里拆包拼着买
                  </h2>

                  <p className="text-xs text-blue-100 leading-relaxed max-w-sm">
                    原装整箱太沉吃不完？我们提供专业车载冷藏箱代购，无菌独立密封分装，结账真实小票拍照核验！
                  </p>

                  {/* Dispatch Counter & Action */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-200 font-medium text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{SHOPPING_BATCH_INFO.departureTime} · 截单仅剩 15 分钟</span>
                    </div>

                    <button
                      onClick={() => setIsNewSplitOpen(true)}
                      className="bg-white hover:bg-amber-50 text-[#0055A5] px-3 py-1.5 rounded-full font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span>我要发起拼单</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Feature Badges */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div
                  onClick={() => {
                    setSelectedCategory('bakery');
                    setActiveTab('category');
                  }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <span className="text-xl">🍰</span>
                  <span className="text-[11px] font-bold text-slate-800 mt-1">烘焙热拼</span>
                  <span className="text-[9px] text-amber-600">瑞士卷/麻薯</span>
                </div>

                <div
                  onClick={() => {
                    setSelectedCategory('fresh');
                    setActiveTab('category');
                  }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <span className="text-xl">🥩</span>
                  <span className="text-[11px] font-bold text-slate-800 mt-1">生鲜原切</span>
                  <span className="text-[9px] text-rose-600">牛排/三文鱼</span>
                </div>

                <div
                  onClick={() => setActiveTab('splits')}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <span className="text-xl">👥</span>
                  <span className="text-[11px] font-bold text-slate-800 mt-1">拼单广场</span>
                  <span className="text-[9px] text-blue-600">差1人锁单</span>
                </div>

                <div
                  onClick={() => setActiveTab('tracker')}
                  className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col items-center cursor-pointer hover:border-amber-200 transition-colors"
                >
                  <span className="text-xl">🧾</span>
                  <span className="text-[11px] font-bold text-slate-800 mt-1">小票核验</span>
                  <span className="text-[9px] text-emerald-600">原价透明</span>
                </div>
              </div>

              {/* Hot Group Buys Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      邻里正在拼 · 差1人即刻锁单
                    </h3>
                  </div>

                  <button
                    onClick={() => setActiveTab('splits')}
                    className="text-xs text-[#0055A5] font-semibold flex items-center hover:underline"
                  >
                    <span>查看全部房间</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
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
                </div>
              </div>

              {/* Popular Products Split / Buy Grid */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>山姆大包装拆分选购</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (支持拼半份或整盒代购)
                    </span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('category')}
                    className="text-xs text-[#0055A5] font-semibold hover:underline"
                  >
                    全部商品 ▾
                  </button>
                </div>

                <div
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
                      onOpenDetail={(p) => setActiveDetailProduct(p)}
                      onQuickSplit={(p) => setActiveDetailProduct(p)}
                      onDirectBuy={(p) => setActiveDetailProduct(p)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CATEGORY CATALOG */}
          {activeTab === 'category' && (
            <div className="space-y-4 text-left">
              {/* Category Segmented Scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-[#0055A5] text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    共找到 <strong className="text-slate-900">{filteredProducts.length}</strong> 件商品
                  </span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    全单冷链包装 · 现场采购
                  </span>
                </div>

                <div
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
                      onOpenDetail={(p) => setActiveDetailProduct(p)}
                      onQuickSplit={(p) => setActiveDetailProduct(p)}
                      onDirectBuy={(p) => setActiveDetailProduct(p)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SPLITS PLAZA */}
          {activeTab === 'splits' && (
            <div className="space-y-4 text-left">
              {/* Header card with action */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-4 text-white shadow-md flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base leading-tight">邻里拼单大厅</h3>
                  <p className="text-xs text-amber-100 mt-1">
                    人满即刻成团，今日 14:00 准点进店采买
                  </p>
                </div>

                <button
                  onClick={() => setIsNewSplitOpen(true)}
                  className="bg-white text-orange-950 px-3.5 py-2 rounded-2xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <PlusCircle className="w-4 h-4 text-amber-600" />
                  <span>发起新拼单</span>
                </button>
              </div>

              {/* Split list */}
              <div className="space-y-3">
                {splitGroups.map((group) => (
                  <SplitGroupCard
                    key={group.id}
                    group={group}
                    onJoin={handleJoinSplitGroup}
                    onShare={(g) => setSelectedShareGroup(g)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TRACKER */}
          {activeTab === 'tracker' && (
            <LiveTrackerView
              orders={orders}
              milestones={milestones}
              onAdvanceMilestone={handleAdvanceMilestone}
              onResetMilestones={() => setMilestones(SHOPPING_MILESTONES)}
            />
          )}

          {/* TAB 5: ORDER HISTORY */}
          {activeTab === 'history' && (
            <OrderHistoryView
              orders={orders}
              onViewTracker={() => setActiveTab('tracker')}
              onViewReceipt={(order) => setSelectedReceiptOrder(order)}
              onViewQrCode={(order) => setSelectedQrOrder(order)}
              onReorder={handleReorder}
            />
          )}
        </main>

        {/* WeChat Mini Program Bottom Tab Bar */}
        <BottomNavBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          cartCount={cartTotalCount}
          onOpenCart={() => setIsCartOpen(true)}
        />
      </div>

      {/* Floating Modals and Sheets */}
      <ProductDetailModal
        product={activeDetailProduct}
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
        onConfirmPay={handleConfirmPay}
      />

      <WeChatPayModal
        isOpen={isWeChatPayOpen}
        onClose={() => setIsWeChatPayOpen(false)}
        amount={
          pendingOrderData
            ? calculateCheckoutTotals(cartItems, pendingOrderData.deliveryMethod, 5).totalPayable
            : 0
        }
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

      {/* Code Export (Taro & Native Mini Program) Modal */}
      <CodeExportModal
        isOpen={isCodeExportOpen}
        onClose={() => setIsCodeExportOpen(false)}
      />
    </div>
  );
}
