/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, SplitOption } from '../types';
import { ProductArtwork } from './ProductArtwork';
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
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, option: SplitOption, quantity: number, isGroupBuy: boolean) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  if (!product) return null;

  const defaultOption = product.splitOptions?.[0] || {
    id: 'whole-default',
    name: '整件原装',
    ratio: 1.0,
    slots: 1,
    weightEstimate: product.originalSpecs,
    price: product.originalPrice,
    description: '山姆原装完整未拆封',
  };

  const [selectedOption, setSelectedOption] = useState<SplitOption>(defaultOption);
  const [quantity, setQuantity] = useState(1);
  const [isGroupBuyMode, setIsGroupBuyMode] = useState(product.canSplit);

  const handleConfirm = () => {
    onAddToCart(product, selectedOption, quantity, isGroupBuyMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Close Bar */}
        <div className="relative">
          <ProductArtwork
            type={product.iconType}
            name={product.name}
            aspectRatio="16:9"
            className="w-full"
          />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 active:scale-95 transition-all"
            aria-label="关闭详情"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badges on artwork */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="bg-[#0055A5] text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
              山姆会员店官方直采
            </span>
            {product.requiresColdChain && (
              <span className="bg-blue-600/90 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Snowflake className="w-3 h-3 text-cyan-200" />
                恒温冷链
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800">
          {/* Title & Specs */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded">
                {product.canSplit ? '大包装·支持拼单' : '整件专职代购'}
              </span>
              <span className="text-xs text-slate-400">原包装: {product.originalSpecs}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">
              {product.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {product.subtitle}
            </p>
          </div>

          {/* Transparent Hygiene & Packaging Policy */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0055A5] shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold text-[#0055A5]">山姆分装与溯源承诺</h4>
              <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                团长在车载恒温操作区使用食品级PP餐盒分装，戴丁腈医用手套与发帽；生鲜提供精准电子称重封签与冰袋。小票原件拍照公开，杜绝临期或劣质调包！
              </p>
            </div>
          </div>

          {/* Split Option Selection */}
          {product.splitOptions && product.splitOptions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800">
                  选择分装规格 / 购买方式
                </label>
                <span className="text-[11px] text-amber-600 font-medium">
                  {selectedOption.ratio < 1 ? '拼单分装免去大包装浪费' : '完整原装未拆'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {product.splitOptions.map((opt) => {
                  const isSelected = selectedOption.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedOption(opt)}
                      className={`p-3 rounded-xl border text-left flex items-start justify-between gap-3 transition-all ${
                        isSelected
                          ? 'border-[#0055A5] bg-blue-50/40 ring-1 ring-[#0055A5]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-[#0055A5] bg-[#0055A5] text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span>{opt.name}</span>
                            <span className="text-[11px] text-slate-500 font-normal">
                              ({opt.weightEstimate})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {opt.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-rose-600 tabular-nums">
                          {formatRMB(opt.price)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-800 block">购买份数</span>
              <span className="text-[10px] text-slate-400">每人限购5份</span>
            </div>

            <div className="flex items-center gap-3 bg-slate-100 rounded-full px-2 py-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-6 h-6 rounded-full bg-white text-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-200 transition-colors shadow-xs"
                aria-label="减少数量"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm font-bold text-slate-900 w-5 text-center tabular-nums">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                disabled={quantity >= 5}
                className="w-6 h-6 rounded-full bg-white text-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-200 transition-colors shadow-xs"
                aria-label="增加数量"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 block">预估应付</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-rose-600 tabular-nums">
                {formatRMB(selectedOption.price * quantity)}
              </span>
              <span className="text-[10px] text-slate-400">
                (代购服务费结算核算)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirm}
              className="bg-[#0055A5] hover:bg-[#004282] active:scale-95 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              <span>
                {selectedOption.ratio < 1 ? '加入拼单车' : '加入代购车'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
