/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OrderRecord } from '../types';
import { Check, Copy } from 'lucide-react';

interface PickupQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderRecord | null;
}

export const PickupQrModal: React.FC<PickupQrModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  if (!isOpen || !order) return null;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(order.pickupCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl p-6 text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <span className="text-xs bg-blue-100 text-[#0055A5] px-2.5 py-0.5 rounded-full font-bold">
            社区自提便民点核验
          </span>
          <h3 className="font-bold text-base text-slate-900 mt-2">
            出示给站长或扫码开柜
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {order.deliveryMethod === 'pickup'
              ? order.pickupStation
              : `送货上门: ${order.deliveryAddress || '配送地址'}`}
          </p>
        </div>

        {/* QR Code SVG */}
        <div className="w-48 h-48 mx-auto bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
          <svg className="w-full h-full text-slate-900" viewBox="0 0 100 100" fill="currentColor">
            <rect x="5" y="5" width="25" height="25" rx="3" fill="#0055A5" />
            <rect x="10" y="10" width="15" height="15" fill="white" />
            <rect x="13" y="13" width="9" height="9" fill="#0055A5" />
            <rect x="70" y="5" width="25" height="25" rx="3" fill="#0055A5" />
            <rect x="75" y="10" width="15" height="15" fill="white" />
            <rect x="78" y="13" width="9" height="9" fill="#0055A5" />
            <rect x="5" y="70" width="25" height="25" rx="3" fill="#0055A5" />
            <rect x="10" y="75" width="15" height="15" fill="white" />
            <rect x="13" y="78" width="9" height="9" fill="#0055A5" />
            <rect x="35" y="10" width="6" height="6" />
            <rect x="45" y="10" width="6" height="6" />
            <rect x="55" y="15" width="6" height="6" />
            <rect x="35" y="25" width="6" height="6" />
            <rect x="45" y="35" width="10" height="10" fill="#0055A5" />
            <rect x="60" y="35" width="6" height="6" />
            <rect x="10" y="35" width="6" height="6" />
            <rect x="20" y="45" width="6" height="6" />
            <rect x="35" y="50" width="6" height="6" />
            <rect x="50" y="55" width="6" height="6" />
            <rect x="65" y="55" width="6" height="6" />
            <rect x="75" y="45" width="6" height="6" />
            <rect x="35" y="70" width="6" height="6" />
            <rect x="45" y="80" width="6" height="6" />
            <rect x="55" y="75" width="6" height="6" />
            <rect x="70" y="75" width="8" height="8" />
            <rect x="85" y="85" width="6" height="6" />
          </svg>
        </div>

        <div className="bg-slate-50 py-2 px-4 rounded-xl inline-flex items-center gap-2">
          <div>
            <span className="text-[10px] text-slate-400 block">提货验证码</span>
            <span className="font-mono text-2xl font-bold text-rose-600 tracking-wider">
              {order.pickupCode}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
            title="复制"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          关闭返回
        </button>
      </div>
    </div>
  );
};
