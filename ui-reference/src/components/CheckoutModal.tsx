/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CartItem, calculateCheckoutTotals, formatRMB } from '../utils/orderCalculations';
import {
  X,
  MapPin,
  Clock,
  ShieldCheck,
  Building,
  Phone,
  User,
  Truck,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currentCommunity: string;
  onConfirmPay: (orderData: {
    deliveryMethod: 'pickup' | 'delivery';
    recipientName: string;
    recipientPhone: string;
    address: string;
    notes: string;
  }) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  currentCommunity,
  onConfirmPay,
}) => {
  if (!isOpen) return null;

  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [recipientName, setRecipientName] = useState('王小萌');
  const [recipientPhone, setRecipientPhone] = useState('13912348821');
  const [address, setAddress] = useState('阳光花园东区3号楼802室');
  const [notes, setNotes] = useState('瑞士卷尽量挑生产日期最新的；若生鲜缺货直接退款');

  const totals = calculateCheckoutTotals(items, deliveryMethod, 5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmPay({
      deliveryMethod,
      recipientName,
      recipientPhone,
      address,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0055A5] text-white">
          <div>
            <h3 className="font-bold text-base leading-tight">确认订单与结算</h3>
            <p className="text-[11px] text-blue-100 mt-0.5">山姆直采 · 专职代购保障</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="关闭结算"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Delivery Method Selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setDeliveryMethod('pickup')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                deliveryMethod === 'pickup'
                  ? 'bg-white text-[#0055A5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>社区便民点自提 (免运费)</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMethod('delivery')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                deliveryMethod === 'delivery'
                  ? 'bg-white text-[#0055A5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>送货上门 (+¥8)</span>
            </button>
          </div>

          {/* Location & Station Card */}
          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#0055A5] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">
                    {deliveryMethod === 'pickup' ? '自提地址' : '送达地址'}
                  </span>
                  <span className="text-[10px] text-[#0055A5] bg-blue-100 px-1.5 py-0.2 rounded font-medium">
                    {deliveryMethod === 'pickup' ? '恒温冷藏柜存放' : '同城专人直送'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">
                  {deliveryMethod === 'pickup'
                    ? `${currentCommunity} 东区1号楼便民自提驿站 (架位A区)`
                    : address}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {deliveryMethod === 'pickup'
                    ? '到货后将向您微信发送独家提货码，凭码开柜或扫码领走'
                    : '采购完成后由团长专车或美团专送直接送至家门口'}
                </p>
              </div>
            </div>

            {deliveryMethod === 'delivery' && (
              <div className="pt-2 border-t border-blue-100/80">
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  门牌详细地址
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0055A5]"
                  placeholder="如：3号楼802室"
                  required
                />
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-3">
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>联系人信息</span>
              <span className="text-[11px] text-emerald-600 font-normal">已绑定微信快捷手机</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">提货人姓名</label>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="text-xs w-full focus:outline-none text-slate-800"
                    placeholder="姓名"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">联系电话</label>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="text-xs w-full focus:outline-none text-slate-800"
                    placeholder="手机号码"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">给团长留言备注</label>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs w-full focus:outline-none text-slate-800"
                  placeholder="例如：冷藏生鲜多放一个冰袋"
                />
              </div>
            </div>
          </div>

          {/* Batch Schedule Notice */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 block">
                本班次采购排期提醒
              </span>
              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                预计今日 14:00 发车前往山姆会员店，17:30 运抵自提点。若遇商品临时断货，将自动全额退款至原支付账户。
              </p>
            </div>
          </div>

          {/* Itemized List Preview */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
            <div className="text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span>商品清单 ({items.length}种商品)</span>
              <span className="text-[11px] text-slate-400">凭山姆纸质小票核验</span>
            </div>

            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between items-center text-xs">
                  <div className="truncate pr-2">
                    <span className="font-medium text-slate-800 truncate block">
                      {it.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {it.selectedOption.name} × {it.quantity}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                    {formatRMB(it.unitPrice * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Math */}
          <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <div className="flex justify-between">
              <span>商品总金额</span>
              <span className="tabular-nums font-semibold text-slate-800">
                {formatRMB(totals.itemsSubtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>团长代购费 (6%公摊)</span>
              <span className="tabular-nums font-semibold text-slate-800">
                {formatRMB(totals.proxyFee)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>冷链恒温打包费</span>
              <span className="tabular-nums font-semibold text-slate-800">
                {totals.packagingFee === 0 ? '已免 (满额/常温)' : formatRMB(totals.packagingFee)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>配送运费</span>
              <span className="tabular-nums font-semibold text-slate-800">
                {totals.deliveryFee === 0 ? '自提免运费' : formatRMB(totals.deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>邻里拼单立减券</span>
              <span className="tabular-nums">- {formatRMB(totals.discount)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold text-slate-900">
              <span className="text-xs">实付金额</span>
              <span className="text-lg text-rose-600 tabular-nums">
                {formatRMB(totals.totalPayable)}
              </span>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-1">
            <button
              type="submit"
              className="w-full bg-[#07C160] hover:bg-[#06AD56] active:scale-98 text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>微信支付 {formatRMB(totals.totalPayable)}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
