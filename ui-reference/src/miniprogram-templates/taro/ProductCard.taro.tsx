/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Taro 跨端组件：山姆商品卡片 (ProductCard.taro.tsx)
 * 适用框架：Taro v3+ (React + TypeScript)
 * 依赖生态：weapp-tailwindcss (直接使用 tailwind 类名)
 */

import React from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';

export interface SplitOption {
  id: string;
  name: string;
  ratio: number;
  slots: number;
  weightEstimate: string;
  price: number;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  categoryId: string;
  originalPrice: number;
  originalSpecs: string;
  canSplit: boolean;
  requiresColdChain: boolean;
  stock: number;
  salesCount: number;
  tags: string[];
  bannerBadge?: string;
  splitOptions?: SplitOption[];
  imageUrl?: string;
}

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
  const lowestSplitPrice = product.splitOptions?.[0]?.price ?? product.originalPrice;

  const handleCardClick = () => {
    onOpenDetail(product);
  };

  return (
    <View 
      className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col justify-between"
      onClick={handleCardClick}
    >
      {/* 顶部图片与角标容器 */}
      <View className="relative w-full aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
        {/* 商品主图 */}
        <Image 
          src={product.imageUrl || '/assets/placeholder-product.png'}
          mode="aspectFill"
          className="w-full h-full"
        />

        {/* 冷链车载/保温角标 */}
        {product.requiresColdChain && (
          <View className="absolute top-2 left-2 bg-blue-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
            <Text>冷链保鲜</Text>
          </View>
        )}

        {/* 拆包拼单徽标 */}
        {product.canSplit && (
          <View className="absolute bottom-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
            <Text>支持分装拼半份</Text>
          </View>
        )}
      </View>

      {/* 商品核心信息区 */}
      <View className="p-2.5 flex-1 flex flex-col justify-between">
        <View>
          <Text className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
            {product.name}
          </Text>
          <Text className="text-[10px] text-slate-400 mt-1 line-clamp-1">
            {product.originalSpecs}
          </Text>
        </View>

        {/* 价格与操作区 */}
        <View className="mt-2 pt-2 border-t border-slate-50">
          <View className="flex items-baseline justify-between mb-2">
            <View className="flex items-baseline gap-0.5">
              <Text className="text-xs text-rose-600 font-bold">¥</Text>
              <Text className="text-base font-bold text-rose-600">
                {product.canSplit ? lowestSplitPrice.toFixed(1) : product.originalPrice.toFixed(1)}
              </Text>
              {product.canSplit && (
                <Text className="text-[10px] text-rose-500 font-normal">起/拼单</Text>
              )}
            </View>
            <Text className="text-[9px] text-slate-400">已代购 {product.salesCount}件</Text>
          </View>

          {/* 底部双按钮：去拼单 / 整件代购 */}
          <View className="grid grid-cols-2 gap-1.5">
            {product.canSplit ? (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickSplit(product);
                }}
                className="py-1 px-1 bg-amber-500 active:bg-amber-600 text-white rounded-lg text-[10px] font-bold text-center leading-normal"
              >
                去拼单
              </Button>
            ) : null}

            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDirectBuy(product);
              }}
              className={`py-1 px-1 rounded-lg text-[10px] font-bold text-center leading-normal ${
                product.canSplit
                  ? 'bg-slate-100 text-slate-700 active:bg-slate-200'
                  : 'col-span-2 bg-blue-600 text-white active:bg-blue-700'
              }`}
            >
              整件代购
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
};
export default ProductCard;
