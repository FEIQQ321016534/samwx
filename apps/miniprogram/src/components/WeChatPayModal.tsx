import { SafeOverlay } from './SafeOverlay';
import React from 'react';
import { View, Text, Button } from './ui';
import { X, ShieldCheck } from './Icons';

export function WeChatPayModal({ isOpen, onClose, amount, walletBalance = 0, devPaymentsEnabled = false, testPaymentsEnabled = false, uatEnabled = false, wechatPaymentEnabled = false, busy = false, onPaymentSuccess, onRefresh }: any) {
  if (!isOpen) return null;
  return <SafeOverlay className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
    <View className="safe-modal-panel w-full bg-white rounded-t-3xl p-5 space-y-4">
      <View className="flex items-center justify-between border-b border-slate-100 pb-3"><Text className="font-bold text-base">确认付款</Text><Button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></Button></View>
      <View className="text-center py-5"><View className="text-xs text-slate-500">本单应付</View><View className="text-3xl font-bold text-slate-900 mt-2">¥{amount.toFixed(2)}</View></View>
      <View className="rounded-xl bg-slate-50 p-3 text-xs flex justify-between"><Text>{uatEnabled ? '测试账户余额' : '账户余额'}</Text><Text>¥{walletBalance.toFixed(2)}</Text></View>
      <Button disabled={busy || walletBalance < amount} className="w-full bg-[#0055A5] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-40" onClick={() => onPaymentSuccess('wallet')}>余额支付</Button>
      <Button disabled={busy || !wechatPaymentEnabled} className="w-full bg-[#07C160] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-40" onClick={() => onPaymentSuccess('wechat')}>{wechatPaymentEnabled ? '微信支付' : '微信支付（待开通）'}</Button>
      <View className="text-[0.6875rem] text-slate-500 flex gap-2"><ShieldCheck className="w-4 h-4 text-slate-400" /><Text>真实微信支付尚未配置。接入后由微信收银台完成验证。</Text></View>
      {devPaymentsEnabled && <Button disabled={busy} className="w-full bg-amber-50 text-amber-800 border border-amber-200 py-3 rounded-xl text-xs" onClick={() => onPaymentSuccess('dev')}>{busy ? '处理中…' : '开发测试付款（不扣真实资金）'}</Button>}
      {uatEnabled && <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-2">
        <View>线上测试专用，订单、付款、退款均为测试记录，不扣真实资金、不安排真实采购配送。</View>
        {testPaymentsEnabled ? <Button disabled={busy} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold" onClick={() => onPaymentSuccess('test')}>{busy ? '处理中…' : '模拟付款，继续测试订单流程'}</Button> : <View>此微信账号尚未获准模拟付款，请联系测试管理员开通。</View>}
        <Button disabled={busy} className="text-[#0055A5] text-xs" onClick={onRefresh}>刷新测试资格</Button>
      </View>}
    </View>
  </SafeOverlay>;
}
