import { Button, View, Text } from './ui';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Product } from '../types';
import { ProductArtwork } from './ProductArtwork';
import { formatRMB } from '../utils/orderCalculations';
import { Users, ShoppingBag, Snowflake, Sparkles } from './Icons';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onQuickSplit: (product: Product) => void;
  onDirectBuy: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  onQuickSplit,
  onDirectBuy,
}) => {
  // Lowest split price if split exists
  const lowestSplitPrice = product.splitOptions?.find((opt) => opt.ratio < 1)?.price;

  return (
    <View
      onClick={() => onOpenDetail(product)}
      className="group bg-white rounded-2xl overflow-hidden border border-slate-100/90 shadow-sm hover:shadow-md hover:border-blue-200/60 transition-all duration-200 flex flex-col cursor-pointer text-left relative"
    >
      {/* Visual Slot */}
      <View className="relative overflow-hidden bg-slate-50">
        <ProductArtwork
          type={product.iconType}
          name={product.name}
          aspectRatio="4:3"
          className="group-hover:scale-102 transition-transform duration-300"
        />

        {/* Top Badges */}
        <View className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          {product.bannerBadge ? (
            <Text className="bg-amber-500 text-white text-[0.6875rem] font-bold px-2 py-0.5 rounded-full shadow-xs">
              {product.bannerBadge}
            </Text>
          ) : (
            <Text />
          )}

          {product.requiresColdChain && (
            <Text className="bg-blue-600/90 backdrop-blur-xs text-white text-[0.625rem] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
              <Snowflake className="w-3 h-3 text-cyan-200" />
              冷链保鲜
            </Text>
          )}
        </View>

        {/* Sales count footer over image */}
        <View className="absolute bottom-1.5 right-2 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded text-[0.625rem] text-white/90">
          已拼 {product.salesCount} 件
        </View>
      </View>

      {/* Info Section */}
      <View className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
        <View>
          {/* Tags */}
          <View className="flex flex-wrap items-center gap-1.5 mb-1 text-[0.6875rem] text-slate-500">
            {product.tags.map((tag, idx) => (
              <Text
                key={idx}
                className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[0.625rem] font-medium"
              >
                {tag}
              </Text>
            ))}
          </View>

          {/* Product Title */}
          <View className="font-bold text-slate-900 text-sm leading-snug line-clamp-1 group-hover:text-[#0055A5] transition-colors">
            {product.name}
          </View>

          {/* Subtitle / Warehouse specs */}
          <View className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {product.subtitle}
          </View>

          <View className="text-[0.6875rem] text-slate-400 mt-1 flex items-center gap-2">
            <Text>原装规格: {product.originalSpecs}</Text>
          </View>
        </View>

        {/* Price & Actions Grid */}
        <View className="pt-2 border-t border-slate-100 flex flex-col gap-2">
          {/* Price rows */}
          <View className="flex items-baseline justify-between">
            <View>
              {product.canSplit && lowestSplitPrice !== undefined ? (
                <View>
                  <Text className="text-[0.625rem] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded mr-1">
                    拼单价
                  </Text>
                  <Text className="text-base font-bold text-rose-600 tabular-nums">
                    {formatRMB(lowestSplitPrice)}
                  </Text>
                  <Text className="text-[0.625rem] text-slate-400 line-through ml-1.5">
                    整件 {formatRMB(product.originalPrice)}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text className="text-[0.625rem] font-medium text-blue-700 bg-blue-50 px-1 py-0.5 rounded mr-1">
                    整盒代购
                  </Text>
                  <Text className="text-base font-bold text-slate-900 tabular-nums">
                    {formatRMB(product.originalPrice)}
                  </Text>
                </View>
              )}
            </View>

            <Text className="text-[0.625rem] text-slate-400">
              代购服务费6%
            </Text>
          </View>

          {/* Action buttons */}
          <View className="grid grid-cols-2 gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
            {product.canSplit ? (
              <>
                <Button
                  onClick={() => onQuickSplit(product)}
                  className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white py-1.5 px-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-xs whitespace-nowrap shrink-0"
                >
                  <Users className="w-3 h-3 shrink-0" />
                  <Text className="truncate">去拼单</Text>
                </Button>
                <Button
                  onClick={() => onDirectBuy(product)}
                  className="bg-slate-100 hover:bg-blue-50 hover:text-[#0055A5] active:scale-95 text-slate-700 py-1.5 px-1.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1 transition-all whitespace-nowrap shrink-0"
                >
                  <ShoppingBag className="w-3 h-3 shrink-0" />
                  <Text className="truncate">整件购</Text>
                </Button>
              </>
            ) : (
              <Button
                onClick={() => onDirectBuy(product)}
                className="col-span-2 bg-[#0055A5] hover:bg-[#004282] active:scale-95 text-white py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-xs whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <Text className="truncate">整件代购 ({formatRMB(product.originalPrice)})</Text>
              </Button>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};
