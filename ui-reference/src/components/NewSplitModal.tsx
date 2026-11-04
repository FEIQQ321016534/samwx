/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product } from '../types';
import { formatRMB } from '../utils/orderCalculations';
import { X, Users, Sparkles, Plus, AlertCircle } from 'lucide-react';

interface NewSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onCreateGroup: (groupData: {
    productId: string;
    productName: string;
    totalSlots: number;
    pricePerSlot: number;
    slotDescription: string;
    category: string;
  }) => void;
}

export const NewSplitModal: React.FC<NewSplitModalProps> = ({
  isOpen,
  onClose,
  products,
  onCreateGroup,
}) => {
  if (!isOpen) return null;

  const splittableProducts = products.filter((p) => p.canSplit);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    splittableProducts[0]?.id || ''
  );
  const [slots, setSlots] = useState<number>(2);
  const [customNote, setCustomNote] = useState<string>('半份包装，冷藏保鲜');

  const selectedProd = products.find((p) => p.id === selectedProductId) || splittableProducts[0];
  const pricePerSlot = selectedProd
    ? Math.round((selectedProd.originalPrice / slots) * 10) / 10
    : 30;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProd) return;

    onCreateGroup({
      productId: selectedProd.id,
      productName: `${selectedProd.name} (${slots}人拼)`,
      totalSlots: slots,
      pricePerSlot,
      slotDescription: `1/${slots}份 (${customNote})`,
      category: selectedProd.categoryId === 'bakery' ? '烘焙熟食' : '生鲜肉禽',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-5 text-left space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">发起邻里拼单大包</h3>
              <p className="text-[11px] text-slate-400">大分量拆开拼，一人一半不浪费</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Select Product */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              选择拼单的山姆大包装商品
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0055A5]"
            >
              {splittableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.originalSpecs} · 原价{formatRMB(p.originalPrice)})
                </option>
              ))}
            </select>
          </div>

          {/* Slots selection */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              期望拼单人数 (拆分份数)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlots(s)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    slots === s
                      ? 'border-[#0055A5] bg-blue-50 text-[#0055A5] ring-1 ring-[#0055A5]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s}人拼 (每人1/{s})
                </button>
              ))}
            </div>
          </div>

          {/* Portioned description */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              分装说明或偏好
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0055A5]"
              placeholder="例如：原味与红茶各半，贴标独立密封"
              required
            />
          </div>

          {/* Calculation hint */}
          <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex items-start gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">成团规则：</span>
              您发起后将自动成为团长，每份预估单价为{' '}
              <span className="font-bold text-rose-600">{formatRMB(pricePerSlot)}</span>
              。满员后将自动锁定进入今日 14:00 采购清单；若截单前未满员，资金将原路秒退！
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>确认发起拼单 (发布至拼单广场)</span>
          </button>
        </form>
      </div>
    </div>
  );
};
