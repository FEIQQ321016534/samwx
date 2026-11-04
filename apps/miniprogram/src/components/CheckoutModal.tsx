import Taro from '@tarojs/taro';
import { Button, View, Form, Input, Text } from './ui';
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
} from './Icons';

interface CheckoutModalProps {
  isOpen: boolean;
  busy?: boolean;
  onClose: () => void;
  items: CartItem[];
  currentCommunity: string;
  pickupStation?: string;
  batch?: any;
  onConfirmPay: (orderData: {
    deliveryMethod: 'pickup' | 'delivery';
    recipientName: string;
    recipientPhone: string;
    address: string;
    notes: string;
  }) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen, busy,
  onClose,
  items,
  currentCommunity, pickupStation, batch,
  onConfirmPay,
}) => {


  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const totals = calculateCheckoutTotals(items, deliveryMethod, 0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !/^1[3-9]\d{9}$/.test(recipientPhone) || (deliveryMethod === 'delivery' && !address.trim())) { Taro.showToast({ title: '请填写姓名、有效手机号和收货地址', icon: 'none' }); return; }
    onConfirmPay({
      deliveryMethod,
      recipientName,
      recipientPhone,
      address,
      notes,
    });
  };

  return (
    <View className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <View
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <View className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0055A5] text-white">
          <View>
            <View className="font-bold text-base leading-tight">确认订单与结算</View>
            <View className="text-[0.6875rem] text-blue-100 mt-0.5">山姆直采 · 专职代购保障</View>
          </View>
          <Button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="关闭结算"
          >
            <X className="w-4 h-4" />
          </Button>
        </View>

        {/* Form Body */}
        <Form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Delivery Method Selector */}
          <View className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <Button
              type="button"
              onClick={() => setDeliveryMethod('pickup')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                deliveryMethod === 'pickup'
                  ? 'bg-white text-[#0055A5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <Text>社区便民点自提 (免运费)</Text>
            </Button>
            <Button
              type="button"
              onClick={() => setDeliveryMethod('delivery')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                deliveryMethod === 'delivery'
                  ? 'bg-white text-[#0055A5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <Text>送货上门 (+¥8)</Text>
            </Button>
          </View>

          {/* Location & Station Card */}
          <View className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3.5 space-y-2">
            <View className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#0055A5] shrink-0 mt-0.5" />
              <View className="flex-1 min-w-0">
                <View className="flex items-center justify-between">
                  <Text className="font-bold text-xs text-slate-900">
                    {deliveryMethod === 'pickup' ? '自提地址' : '送达地址'}
                  </Text>
                  <Text className="text-[0.625rem] text-[#0055A5] bg-blue-100 px-1.5 py-0.2 rounded font-medium">
                    {deliveryMethod === 'pickup' ? '按站点条件保管' : '同城专人直送'}
                  </Text>
                </View>
                <View className="text-xs font-semibold text-slate-800 mt-0.5">
                  {deliveryMethod === 'pickup'
                    ? pickupStation || currentCommunity
                    : address}
                </View>
                <View className="text-[0.6875rem] text-slate-500 mt-0.5">
                  {deliveryMethod === 'pickup'
                    ? '到货后可在订单中查看提货码，向自提点工作人员出示核销'
                    : '配送限所选社区的服务范围，具体送达安排由代购商确认'}
                </View>
              </View>
            </View>

            {deliveryMethod === 'delivery' && (
              <View className="pt-2 border-t border-blue-100/80">
                <View className="text-[0.6875rem] font-medium text-slate-600 block mb-1">
                  门牌详细地址
                </View>
                <Input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#0055A5]"
                  placeholder="如：3号楼802室"
                  required
                />
              </View>
            )}
          </View>

          {/* Contact Details */}
          <View className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-3">
            <View className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <Text>联系人信息</Text>
              <Text className="text-[0.6875rem] text-emerald-600 font-normal">请填写有效联系电话</Text>
            </View>

            <View className="grid grid-cols-2 gap-2">
              <View>
                <View className="text-[0.625rem] text-slate-500 block mb-0.5">提货人姓名</View>
                <View className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <Input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="text-xs w-full focus:outline-none text-slate-800"
                    placeholder="姓名"
                    required
                  />
                </View>
              </View>

              <View>
                <View className="text-[0.625rem] text-slate-500 block mb-0.5">联系电话</View>
                <View className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <Input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="text-xs w-full focus:outline-none text-slate-800"
                    placeholder="手机号码"
                    required
                  />
                </View>
              </View>
            </View>

            <View>
              <View className="text-[0.625rem] text-slate-500 block mb-0.5">给团长留言备注</View>
              <View className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs w-full focus:outline-none text-slate-800"
                  placeholder="例如：冷藏生鲜多放一个冰袋"
                />
              </View>
            </View>
          </View>

          {/* Batch Schedule Notice */}
          <View className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <View className="text-xs">
              <Text className="font-bold text-amber-900 block">
                本班次采购排期提醒
              </Text>
              <View className="text-amber-800 text-[0.6875rem] mt-0.5 leading-relaxed">
                {batch ? `本期截单：${new Date(batch.cutoffAt).toLocaleString('zh-CN', { hour12: false })}；预计自提：${new Date(batch.pickupStartAt).toLocaleString('zh-CN', { hour12: false })}。` : '采购安排以代购商发布的批次为准。'}未成团或缺货款项退入小程序账户余额，称重商品按实多退少补。
              </View>
            </View>
          </View>

          {/* Itemized List Preview */}
          <View className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
            <View className="text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
              <Text>商品清单 ({items.length}种商品)</Text>
              <Text className="text-[0.6875rem] text-slate-400">凭山姆纸质小票核验</Text>
            </View>

            <View className="space-y-2">
              {items.map((it) => (
                <View key={it.id} className="flex justify-between items-center text-xs">
                  <View className="truncate pr-2">
                    <Text className="font-medium text-slate-800 truncate block">
                      {it.name}
                    </Text>
                    <Text className="text-[0.625rem] text-slate-400">
                      {it.selectedOption.name} × {it.quantity}
                    </Text>
                  </View>
                  <Text className="font-semibold text-slate-900 tabular-nums shrink-0">
                    {formatRMB(it.unitPrice * it.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Pricing Math */}
          <View className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <View className="flex justify-between">
              <Text>商品总金额</Text>
              <Text className="tabular-nums font-semibold text-slate-800">
                {formatRMB(totals.itemsSubtotal)}
              </Text>
            </View>
            <View className="flex justify-between">
              <Text>团长代购费 (6%公摊)</Text>
              <Text className="tabular-nums font-semibold text-slate-800">
                {formatRMB(totals.proxyFee)}
              </Text>
            </View>
            <View className="flex justify-between">
              <Text>冷链包装费</Text>
              <Text className="tabular-nums font-semibold text-slate-800">
                {totals.packagingFee === 0 ? '已免 (满额/常温)' : formatRMB(totals.packagingFee)}
              </Text>
            </View>
            <View className="flex justify-between">
              <Text>配送运费</Text>
              <Text className="tabular-nums font-semibold text-slate-800">
                {totals.deliveryFee === 0 ? '自提免运费' : formatRMB(totals.deliveryFee)}
              </Text>
            </View>
            <View className="flex justify-between text-emerald-600 font-medium">
              <Text>邻里拼单立减券</Text>
              <Text className="tabular-nums">- {formatRMB(totals.discount)}</Text>
            </View>

            <View className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold text-slate-900">
              <Text className="text-xs">实付金额</Text>
              <Text className="text-lg text-rose-600 tabular-nums">
                {formatRMB(totals.totalPayable)}
              </Text>
            </View>
          </View>

          {/* Submit CTA */}
          <View className="pt-1">
            <Button
              type="submit" disabled={busy}
              className="w-full bg-[#07C160] hover:bg-[#06AD56] active:scale-98 text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Text>{busy ? '正在提交…' : '确认订单'} {formatRMB(totals.totalPayable)}</Text>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </View>
        </Form>
      </View>
    </View>
  );
};
