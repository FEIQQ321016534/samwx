import { Button, View, Text } from './ui';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, SplitOption } from '../types';
import { ProductArtwork } from './ProductArtwork';
import { availableQuantity } from '../services/api';
import { formatRMB } from '../utils/orderCalculations';
import {
  X,
  ShieldCheck,
  Snowflake,
  PackageCheck,
  Check,
  Plus,
  Minus,
  Sparkles,
} from './Icons';

interface ProductDetailModalProps {
  product: Product | null;
  initialWhole?: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, option: SplitOption, quantity: number, isGroupBuy: boolean) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product, initialWhole,
  onClose,
  onAddToCart,
}) => {


  const defaultOption = product?.splitOptions?.[0] || {
    id: 'whole-default',
    name: '整件原装',
    ratio: 1.0,
    slots: 1,
    weightEstimate: product?.originalSpecs,
    price: product?.originalPrice,
    description: '山姆原装完整未拆封',
  };

  const [selectedOption, setSelectedOption] = useState<SplitOption>(defaultOption);
  const [quantity, setQuantity] = useState(1);
  const [isGroupBuyMode, setIsGroupBuyMode] = useState(product?.canSplit);

  React.useEffect(() => { if (product) { setSelectedOption(product.splitOptions?.find((o) => initialWhole ? o.ratio === 1 : o.ratio < 1) || defaultOption); setQuantity(1); } }, [product?.id, initialWhole]);

  if (!product) return null;
  const maxQuantity = Math.min(availableQuantity(product,selectedOption), selectedOption.slots > 1 ? selectedOption.slots : 100);
  const handleConfirm = () => {
    if (!maxQuantity || quantity > maxQuantity) return;
    onAddToCart(product, selectedOption, quantity, isGroupBuyMode);
    onClose();
  };

  return (
    <View className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <View
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Close Bar */}
        <View className="relative">
          <ProductArtwork
            type={product.iconType}
            name={product.name}
            aspectRatio="16:9"
            className="w-full"
          />

          <Button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 active:scale-95 transition-all"
            aria-label="关闭详情"
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Badges on artwork */}
          <View className="absolute bottom-3 left-3 flex items-center gap-2">
            <Text className="bg-[#0055A5] text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
              代购商线下采购
            </Text>
            {product.requiresColdChain && (
              <Text className="bg-blue-600/90 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Snowflake className="w-3 h-3 text-cyan-200" />
                需冷藏保鲜
              </Text>
            )}
          </View>
        </View>

        {/* Scrollable Body */}
        <View className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800">
          {/* Title & Specs */}
          <View>
            <View className="flex items-center gap-2 mb-1">
              <Text className="bg-amber-100 text-amber-900 text-[0.6875rem] font-bold px-2 py-0.5 rounded">
                {product?.canSplit ? '大包装·支持拼单' : '整件专职代购'}
              </Text>
              <Text className="text-xs text-slate-400">原包装: {product?.originalSpecs}</Text>
            </View>
            <View className="text-lg font-bold text-slate-900 leading-snug">
              {product.name}
            </View>
            <View className="text-xs text-slate-500 mt-1 leading-relaxed">
              {product.subtitle}
            </View>
          </View>

          {/* Transparent Hygiene & Packaging Policy */}
          <View className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0055A5] shrink-0 mt-0.5" />
            <View className="text-xs">
              <View className="font-bold text-[#0055A5]">山姆分装与溯源承诺</View>
              <View className="text-slate-600 text-[0.6875rem] mt-0.5 leading-relaxed">
                商品按所选规格代购或分装，称重商品按实际金额多退少补。请查看代购商上传的采购凭证和处理记录；保温及交付安排以该商户说明为准。
              </View>
            </View>
          </View>

          {/* Split Option Selection */}
          {product.splitOptions && product.splitOptions.length > 0 && (
            <View>
              <View className="flex items-center justify-between mb-2">
                <View className="text-xs font-bold text-slate-800">
                  选择分装规格 / 购买方式
                </View>
                <Text className="text-[0.6875rem] text-amber-600 font-medium">
                  {selectedOption.ratio < 1 ? '拼单分装免去大包装浪费' : '完整原装未拆'}
                </Text>
              </View>

              <View className="grid grid-cols-1 gap-2">
                {product.splitOptions.map((opt) => {
                  const isSelected = selectedOption.id === opt.id;
                  return (
                    <Button
                      key={opt.id}
                      onClick={() => { setSelectedOption(opt); setQuantity(1); }}
                      className={`p-3 rounded-xl border text-left flex items-start justify-between gap-3 transition-all ${
                        isSelected
                          ? 'border-[#0055A5] bg-blue-50/40 ring-1 ring-[#0055A5]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <View className="flex items-start gap-2.5">
                        <View
                          className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-[#0055A5] bg-[#0055A5] text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </View>
                        <View>
                          <View className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Text>{opt.name}</Text>
                            <Text className="text-[0.6875rem] text-slate-500 font-normal">
                              ({opt.weightEstimate})
                            </Text>
                          </View>
                          <View className="text-[0.6875rem] text-slate-500 mt-0.5">
                            {opt.description}
                          </View>
                        </View>
                      </View>

                      <View className="text-right shrink-0">
                        <Text className="text-base font-bold text-rose-600 tabular-nums">
                          {formatRMB(opt.price)}
                        </Text>
                      </View>
                    </Button>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity Selector */}
          <View className="flex items-center justify-between pt-2 border-t border-slate-100">
            <View>
              <Text className="text-xs font-bold text-slate-800 block">购买份数</Text>
              <Text className="text-[0.625rem] text-slate-400">{product.inventoryNeedsReview ? '库存待商户复核' : `本规格最多可选${maxQuantity}份`}</Text>
            </View>

            <View className="flex items-center gap-3 bg-slate-100 rounded-full px-2 py-1">
              <Button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-6 h-6 rounded-full bg-white text-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-200 transition-colors shadow-xs"
                aria-label="减少数量"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <Text className="text-sm font-bold text-slate-900 w-5 text-center tabular-nums">
                {quantity}
              </Text>
              <Button
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                className="w-6 h-6 rounded-full bg-white text-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-200 transition-colors shadow-xs"
                aria-label="增加数量"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </View>
          </View>
        </View>

        {/* Footer CTAs */}
        <View className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <View>
            <Text className="text-[0.6875rem] text-slate-500 block">预估应付</Text>
            <View className="flex items-baseline gap-1">
              <Text className="text-xl font-bold text-rose-600 tabular-nums">
                {formatRMB(selectedOption.price * quantity)}
              </Text>
              <Text className="text-[0.625rem] text-slate-400">
                (代购服务费结算核算)
              </Text>
            </View>
          </View>

          <View className="flex items-center gap-2">
            <Button
              onClick={handleConfirm} disabled={maxQuantity <= 0}
              className="bg-[#0055A5] hover:bg-[#004282] active:scale-95 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <Text>
                {maxQuantity <= 0 ? '暂不可售' : selectedOption.ratio < 1 ? '加入拼单车' : '加入代购车'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
};
