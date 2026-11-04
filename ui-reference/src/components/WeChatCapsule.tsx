/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MapPin, ChevronDown, Bell, ShieldCheck } from 'lucide-react';
import { MOCK_COMMUNITIES } from '../data/mockData';

interface WeChatCapsuleProps {
  currentCommunity: string;
  onSelectCommunity: (name: string) => void;
  cartCount: number;
  onOpenCart: () => void;
}

export const WeChatCapsule: React.FC<WeChatCapsuleProps> = ({
  currentCommunity,
  onSelectCommunity,
  cartCount,
  onOpenCart,
}) => {
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#0055A5] text-white shadow-md">
      {/* Mini Program System Status Bar */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 text-xs text-white/80 font-medium">
        <span>09:41</span>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span>5G</span>
          <span className="inline-block w-4 h-2 border border-white/70 rounded-xs relative">
            <span className="absolute left-0.5 top-0.5 bottom-0.5 right-1 bg-white rounded-xs"></span>
          </span>
        </div>
      </div>

      {/* Mini Program Header & WeChat Capsule Area */}
      <div className="flex items-center justify-between px-3 py-2">
        {/* Neighborhood Community Station Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 bg-black/25 hover:bg-black/35 active:scale-95 transition-all px-2.5 py-1.5 rounded-full text-left"
            aria-label="选择自提社区"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div className="truncate max-w-[140px] xs:max-w-[180px]">
              <span className="text-xs font-semibold block leading-tight text-white truncate">
                {currentCommunity}
              </span>
              <span className="text-[10px] text-blue-100 block leading-none truncate">
                便民自提驿站
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-white/70 shrink-0 ml-0.5" />
          </button>

          {/* Community Switch Dropdown */}
          {showDropdown && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-100 flex items-center justify-between">
                <span>选择您所在社区自提点</span>
                <span className="text-[#0055A5]">同城冷链</span>
              </div>
              {MOCK_COMMUNITIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectCommunity(c.name);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50/70 transition-colors flex flex-col ${
                    currentCommunity === c.name ? 'bg-blue-50/90 font-medium text-[#0055A5]' : 'text-slate-700'
                  }`}
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-[10px] text-slate-400 truncate">{c.station}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* WeChat Standard Capsule Button (••• | ⨀) */}
        <div className="flex items-center gap-2">
          {/* Mini Program Capsule */}
          <div className="flex items-center bg-white/20 backdrop-blur-md rounded-full border border-white/30 px-2 py-1 text-white">
            <button
              className="text-white hover:opacity-80 px-1 py-0.5 text-xs font-bold tracking-widest active:scale-95 transition-transform"
              aria-label="小程序更多选项"
              title="小程序选项"
            >
              •••
            </button>
            <div className="w-[1px] h-3 bg-white/40 mx-1.5"></div>
            <button
              className="text-white hover:opacity-80 px-1 py-0.5 active:scale-95 transition-transform flex items-center justify-center"
              aria-label="关闭小程序"
              title="退出小程序"
            >
              <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white"></div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Trust & Dispatch Ribbon */}
      <div className="bg-[#004282] px-3.5 py-1.5 text-[11px] text-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-1.5 py-0.2 rounded-xs">
            今日发车
          </span>
          <span className="truncate">今日 14:00 准点进店采购 · 17:30 便民点自提</span>
        </div>
        <div className="text-[11px] text-amber-300 font-medium shrink-0 ml-2">
          满199免保温冷链费
        </div>
      </div>
    </header>
  );
};
