/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { OrderRecord } from '../types';
import { formatRMB } from '../utils/orderCalculations';
import { X } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderRecord | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl p-5 text-slate-800 font-mono text-xs space-y-3 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Paper tear jagged top effect */}
        <div className="text-center pb-2 border-b-2 border-dashed border-slate-300">
          <h3 className="font-bold text-sm tracking-widest text-slate-900">
            山姆会员商店
          </h3>
          <p className="text-[10px] text-slate-500">SAM'S CLUB WHOLESALE</p>
          <p className="text-[10px] text-slate-400 mt-1">
            会员卡号: 8802********9912 (卓越会员)
          </p>
          <p className="text-[10px] text-slate-400">
            收银台: POS-06 · 收款员: 0822
          </p>
          <p className="text-[10px] text-slate-400">
            交易时间: {order.createdAt}:24
          </p>
          <p className="text-[10px] text-slate-400 font-semibold">
            凭证号: {order.orderId}
          </p>
        </div>

        {/* Receipt Table */}
        <div className="space-y-1.5 py-1 border-b border-dashed border-slate-300 text-[11px]">
          <div className="flex justify-between font-bold text-slate-700">
            <span>品名/规格</span>
            <span>单价×数量 金额</span>
          </div>
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between">
              <span className="truncate max-w-[170px]">{it.name}</span>
              <span className="tabular-nums">
                {it.unitPrice.toFixed(2)} × {it.quantity} = {(it.unitPrice * it.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Receipt Totals */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-500 text-[10px]">
            <span>商品原价金额</span>
            <span>¥ {order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-[10px]">
            <span>专职代购公摊费 (6%)</span>
            <span>¥ {order.proxyFee.toFixed(2)}</span>
          </div>
          {order.packagingFee > 0 && (
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>冷链恒温打包费</span>
              <span>¥ {order.packagingFee.toFixed(2)}</span>
            </div>
          )}
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>配送费</span>
              <span>¥ {order.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-600 text-[10px]">
              <span>邻里拼单优惠券</span>
              <span>- ¥ {order.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200">
            <span>实收总计</span>
            <span className="text-rose-600">¥ {order.totalPaid.toFixed(2)}</span>
          </div>
        </div>

        {/* Barcode Graphic */}
        <div className="pt-2 flex flex-col items-center">
          <div className="h-10 w-4/5 bg-slate-800 flex items-center justify-center text-white text-[10px] tracking-[6px] font-mono select-none">
            |||||||||||||||||||||||||||||
          </div>
          <span className="text-[9px] text-slate-400 mt-1">
            {order.orderId.replace(/-/g, ' ')}
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          关闭小票凭证
        </button>
      </div>
    </div>
  );
};
