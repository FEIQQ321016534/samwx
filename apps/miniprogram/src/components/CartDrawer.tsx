import { Button, View, Text } from './ui';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ScrollView } from '@tarojs/components';
import { useSafeWindowInsets } from './SafeOverlay';
import { CartItem } from '../utils/orderCalculations';
import { formatRMB, calculateCheckoutTotals } from '../utils/orderCalculations';
import { X, Trash2, Plus, Minus, ArrowRight, ShieldCheck, ShoppingBag } from './Icons';

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
  const safe = useSafeWindowInsets();
  if (!isOpen) return null;

  const totals = calculateCheckoutTotals(items, 'pickup', 0);

  return (
    <View className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose}>
      <View
        className="cart-safe-panel w-full max-w-md bg-white h-full shadow-2xl flex flex-col text-left"
        style={{paddingTop:safe.top,paddingBottom:safe.bottom}}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <View className="p-4 shrink-0 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80">
          <View className="min-w-0 flex-1 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#0055A5]" />
            <View className="min-w-0 truncate font-bold text-slate-900 text-base">待拼单与代购清单</View>
            <Text className="shrink-0 text-xs bg-blue-100 text-[#0055A5] px-2 py-0.5 rounded-full font-medium tabular-nums">
              {items.reduce((s, i) => s + i.quantity, 0)} 件
            </Text>
          </View>

          <Button
            onClick={onClose}
            style={{minWidth:'44px',minHeight:'44px'}}
            className="cart-close-button shrink-0 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            aria-label="关闭清单"
          >
            <X className="w-5 h-5" />
          </Button>
        </View>

        {/* Item List */}
        <ScrollView scrollY className="flex-1 min-h-0" style={{height:'0px'}}>
        <View className={`p-4 space-y-3 ${items.length === 0 ? 'h-full' : ''}`}>
          {items.length === 0 ? (
            <View className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <View className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
                <ShoppingBag className="w-8 h-8" />
              </View>
              <View className="font-medium text-slate-600 text-sm">清单空空如也</View>
              <View className="text-xs text-slate-400 mt-1">去挑选山姆招牌烘焙或生鲜参与拼单吧</View>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 hover:border-blue-100 transition-all"
              >
                <View className="flex-1 min-w-0">
                  <View className="flex items-center gap-1.5 mb-1">
                    <Text
                      className={`text-[0.625rem] font-bold px-1.5 py-0.2 rounded ${
                        item.selectedOption.ratio < 1
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-100 text-[#0055A5]'
                      }`}
                    >
                      {item.selectedOption.ratio < 1 ? '拼单分装' : '整件原装'}
                    </Text>
                    <View className="text-xs font-bold text-slate-900 truncate">
                      {item.name}
                    </View>
                  </View>

                  <View className="text-[0.6875rem] text-slate-500 flex items-center gap-2">
                    <Text>规格: {item.selectedOption.name}</Text>
                    <Text>·</Text>
                    <Text className="text-slate-400">{item.selectedOption.weightEstimate}</Text>
                  </View>

                  <View className="mt-1 flex items-baseline gap-1">
                    <Text className="text-sm font-bold text-rose-600 tabular-nums">
                      {formatRMB(item.unitPrice)}
                    </Text>
                    <Text className="text-[0.625rem] text-slate-400">/ 份</Text>
                  </View>
                </View>

                {/* Stepper & Delete */}
                <View className="flex flex-col items-end gap-2 shrink-0">
                  <Button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                    title="移除"
                    aria-label={`移除 ${item.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>

                  <View className="flex items-center gap-2 bg-white rounded-full px-2 py-0.5 border border-slate-200">
                    <Button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      aria-label="减少"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </Button>
                    <Text className="text-xs font-bold text-slate-900 w-4 text-center tabular-nums">
                      {item.quantity}
                    </Text>
                    <Button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      aria-label="增加"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </Button>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
        </ScrollView>

        {/* Bottom Total & Checkout */}
        {items.length > 0 && (
          <View className="shrink-0 p-4 bg-white border-t border-slate-100 shadow-lg space-y-3">
            {/* Fee summary breakdown */}
            <View className="space-y-1.5 text-xs text-slate-500">
              <View className="flex justify-between">
                <Text>商品小计</Text>
                <Text className="font-semibold text-slate-900 tabular-nums">
                  {formatRMB(totals.itemsSubtotal)}
                </Text>
              </View>
              <View className="flex justify-between">
                <Text>团长代购费 (6%基准)</Text>
                <Text className="font-semibold text-slate-900 tabular-nums">
                  {formatRMB(totals.proxyFee)}
                </Text>
              </View>
              <View className="flex justify-between">
                <Text>冷链包装费</Text>
                <Text className="font-semibold text-slate-900 tabular-nums">
                  {totals.packagingFee === 0 ? '已免 (满额/常温)' : formatRMB(totals.packagingFee)}
                </Text>
              </View>
              {totals.discount > 0 && <View className="flex justify-between text-emerald-600">
                <Text>邻里拼单专享优惠券</Text>
                <Text className="font-semibold tabular-nums">
                  - {formatRMB(totals.discount)}
                </Text>
              </View>}
            </View>

            <View className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <View>
                <Text className="text-[0.6875rem] text-slate-400 block">预估实付金额</Text>
                <Text className="text-xl font-bold text-rose-600 tabular-nums">
                  {formatRMB(totals.totalPayable)}
                </Text>
              </View>

              <Button
                onClick={onProceedCheckout}
                className="bg-[#0055A5] hover:bg-[#004282] active:scale-95 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Text>去结算下单</Text>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};
