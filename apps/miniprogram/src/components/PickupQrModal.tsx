import React, { useMemo } from 'react';
import Taro from '@tarojs/taro';
import qrcode from 'qrcode-generator';
import { View, Text, Button } from './ui';
export function PickupQrModal({ isOpen, onClose, order }: any) {
  const matrix = useMemo(() => {
    if (!order?.pickupCode) return [];
    const qr = qrcode(0, 'M'); qr.addData(JSON.stringify({ orderId: order.orderId, pickupCode: order.pickupCode })); qr.make();
    return Array.from({ length: qr.getModuleCount() }, (_, row) => Array.from({ length: qr.getModuleCount() }, (_, col) => qr.isDark(row, col)));
  }, [order?.orderId, order?.pickupCode]);
  if (!isOpen || !order) return null;
  const n = matrix.length;
  return <View className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <View className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-4">
      <View className="font-bold">社区自提核验</View><View className="text-xs text-slate-500">{order.pickupStation}</View>
      {n ? <View className="relative bg-white mx-auto" style={{ width: '400rpx', height: '400rpx', border: '20rpx solid white' }}>{matrix.flatMap((row, y) => row.map((dark, x) => dark ? <View key={`${x}-${y}`} style={{ position: 'absolute', left: `${x * 100 / n}%`, top: `${y * 100 / n}%`, width: `${100 / n + 0.02}%`, height: `${100 / n + 0.02}%`, background: '#0055A5' }} /> : null))}</View> : <View className="p-5 text-slate-400 text-xs">订单尚未生成提货凭证</View>}
      <View className="text-[0.625rem] text-slate-400">提货码仅供本人提货时出示</View><View className="font-mono text-2xl font-bold text-rose-600">{order.pickupCode || '待生成'}</View>
      {order.pickupCode && <Button className="text-xs text-[#0055A5]" onClick={() => Taro.setClipboardData({ data: order.pickupCode })}>复制提货码</Button>}
      <Button className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs" onClick={onClose}>关闭</Button>
    </View>
  </View>;
}
