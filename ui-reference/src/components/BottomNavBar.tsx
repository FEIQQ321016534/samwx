/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, Layers, Users, Truck, ClipboardList, ShoppingBag } from 'lucide-react';

export type NavTab = 'home' | 'category' | 'splits' | 'tracker' | 'history';

interface BottomNavBarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  cartCount: number;
  onOpenCart: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onChangeTab,
  cartCount,
  onOpenCart,
}) => {
  return (
    <nav
      className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-1.5 py-1 shadow-lg"
      aria-label="小程序底部导航"
    >
      <div className="grid grid-cols-5 items-center h-14 max-w-lg mx-auto relative">
        {/* Tab 1: Home */}
        <button
          onClick={() => onChangeTab('home')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'home' ? 'text-[#0055A5] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="首页"
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">首页</span>
        </button>

        {/* Tab 2: Category */}
        <button
          onClick={() => onChangeTab('category')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'category' ? 'text-[#0055A5] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="分类导航"
        >
          <Layers className={`w-5 h-5 ${activeTab === 'category' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">分类选购</span>
        </button>

        {/* Tab 3: Splits Plaza */}
        <button
          onClick={() => onChangeTab('splits')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] relative transition-colors ${
            activeTab === 'splits' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="拼单广场"
        >
          <Users className={`w-5 h-5 ${activeTab === 'splits' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">拼单广场</span>
          {/* Subtle live indicator badge */}
          <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
        </button>

        {/* Tab 4: Live Tracker */}
        <button
          onClick={() => onChangeTab('tracker')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] relative transition-colors ${
            activeTab === 'tracker' ? 'text-[#0055A5] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="代购进度追踪"
        >
          <Truck className={`w-5 h-5 ${activeTab === 'tracker' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">代购追踪</span>
          <span className="absolute top-1 right-2 text-[8px] bg-red-500 text-white font-bold px-1 rounded-full scale-90">
            采购中
          </span>
        </button>

        {/* Tab 5: Order History */}
        <button
          onClick={() => onChangeTab('history')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'history' ? 'text-[#0055A5] font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-label="历史订单"
        >
          <ClipboardList className={`w-5 h-5 ${activeTab === 'history' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">历史订单</span>
        </button>
      </div>

      {/* Floating Quick Cart Pill if items > 0 */}
      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="absolute -top-12 right-4 bg-[#0055A5] hover:bg-[#004282] active:scale-95 text-white shadow-xl shadow-blue-900/30 px-3.5 py-2 rounded-full flex items-center gap-2 border-2 border-white transition-all z-50 cursor-pointer"
          aria-label={`查看清单 ${cartCount} 件`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="text-xs font-bold">拼单车</span>
          <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums">
            {cartCount}
          </span>
        </button>
      )}
    </nav>
  );
};
