/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CartItem } from '../utils/orderCalculations';
import { formatRMB, calculateCheckoutTotals } from '../utils/orderCalculations';
import { X, Trash2, Plus, Minus, ArrowRight, ShieldCheck, ShoppingBag } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onProceedCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onProceedCheckout,
}) => {
  if (!isOpen) return null;

  const totals = calculateCheckoutTotals(items, 'pickup', 5);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col text-left justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#0055A5]" />
            <h3 className="font-bold text-slate-900 text-base">待拼单与代购清单</h3>
            <span className="text-xs bg-blue-100 text-[#0055A5] px-2 py-0.5 rounded-full font-medium tabular-nums">
              {items.reduce((s, i) => s + i.quantity, 0)} 件
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            aria-label="关闭清单"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="font-medium text-slate-600 text-sm">清单空空如也</p>
              <p className="text-xs text-slate-400 mt-1">去挑选山姆招牌烘焙或生鲜参与拼单吧</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 hover:border-blue-100 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        item.selectedOption.ratio < 1
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-100 text-[#0055A5]'
                      }`}
                    >
                      {item.selectedOption.ratio < 1 ? '拼单分装' : '整件原装'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {item.name}
                    </h4>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>规格: {item.selectedOption.name}</span>
                    <span>·</span>
                    <span className="text-slate-400">{item.selectedOption.weightEstimate}</span>
                  </div>

                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-sm font-bold text-rose-600 tabular-nums">
                      {formatRMB(item.unitPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400">/ 份</span>
                  </div>
                </div>

                {/* Stepper & Delete */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                    title="移除"
                    aria-label={`移除 ${item.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2 bg-white rounded-full px-2 py-0.5 border border-slate-200">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      aria-label="减少"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-xs font-bold text-slate-900 w-4 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      aria-label="增加"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Total & Checkout */}
        {items.length > 0 && (
          <div className="p-4 bg-white border-t border-slate-100 shadow-lg space-y-3">
            {/* Fee summary breakdown */}
            <div className="space-y-1.5 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>商品小计</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatRMB(totals.itemsSubtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>团长代购费 (6%基准)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatRMB(totals.proxyFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>冷链恒温打包费</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {totals.packagingFee === 0 ? '已免 (满额/常温)' : formatRMB(totals.packagingFee)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>邻里拼单专享优惠券</span>
                <span className="font-semibold tabular-nums">
                  - {formatRMB(totals.discount)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">预估实付金额</span>
                <span className="text-xl font-bold text-rose-600 tabular-nums">
                  {formatRMB(totals.totalPayable)}
                </span>
              </div>

              <button
                onClick={onProceedCheckout}
                className="bg-[#0055A5] hover:bg-[#004282] active:scale-95 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <span>去结算下单</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
