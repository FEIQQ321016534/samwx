import { Button, Option, View, Form, Select, Input, Text } from './ui';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product } from '../types';
import { formatRMB } from '../utils/orderCalculations';
import { X, Users, Sparkles, Plus, AlertCircle } from './Icons';

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


  const splittableProducts = products.filter((p) => p.canSplit && !p.inventoryNeedsReview);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    splittableProducts[0]?.id || ''
  );
  const [slots, setSlots] = useState<number>(2);
  const [customNote, setCustomNote] = useState<string>('半份包装，冷藏保鲜');

  const selectedProd = products.find((p) => p.id === selectedProductId) || splittableProducts[0];
  const pricePerSlot = selectedProd
    ? selectedProd.splitOptions?.find((o) => o.slots === slots && o.ratio < 1)?.price || 0
    : 30;

  React.useEffect(() => { const first = selectedProd?.splitOptions?.find((o) => o.ratio < 1); if (first) setSlots(first.slots); }, [selectedProductId, selectedProd?.id]);
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProd || !selectedProd.splitOptions?.some((o) => o.slots === slots && o.ratio < 1)) return;

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
    <View className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <View
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-5 text-left space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between border-b border-slate-100 pb-3">
          <View className="flex items-center gap-2">
            <View className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </View>
            <View>
              <View className="font-bold text-sm text-slate-900">发起邻里拼单大包</View>
              <View className="text-[0.6875rem] text-slate-400">大分量拆开拼，一人一半不浪费</View>
            </View>
          </View>

          <Button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </Button>
        </View>

        <Form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Select Product */}
          <View>
            <View className="font-bold text-slate-800 block mb-1">
              选择拼单的山姆大包装商品
            </View>
            <Select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0055A5]"
            >
              {splittableProducts.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name} ({p.originalSpecs} · 原价{formatRMB(p.originalPrice)})
                </Option>
              ))}
            </Select>
          </View>

          {/* Slots selection */}
          <View>
            <View className="font-bold text-slate-800 block mb-1">
              期望拼单人数 (拆分份数)
            </View>
            <View className="grid grid-cols-3 gap-2">
              {Array.from(new Set(selectedProd?.splitOptions?.filter((o) => o.ratio < 1).map((o) => o.slots) || [2])).map((s) => (
                <Button
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
                </Button>
              ))}
            </View>
          </View>

          {/* Portioned description */}
          <View>
            <View className="font-bold text-slate-800 block mb-1">
              分装说明或偏好
            </View>
            <Input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0055A5]"
              placeholder="例如：原味与红茶各半，贴标独立密封"
              required
            />
          </View>

          {/* Calculation hint */}
          <View className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex items-start gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <View className="text-[0.6875rem] leading-relaxed">
              <Text className="font-bold">成团规则：</Text>
              您发起后将成为拼单发起人，付款后计入成团份数，每份预估单价为{' '}
              <Text className="font-bold text-rose-600">{formatRMB(pricePerSlot)}</Text>
              。满员后将自动锁定进入所选批次采购清单；若截单前未满员，已付款项将退入小程序账户余额！
            </View>
          </View>

          <Button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <Text>确认发起拼单 (发布至拼单广场)</Text>
          </Button>
        </Form>
      </View>
    </View>
  );
};
