import React from 'react';
import { PrivateMedia } from './PrivateMedia';
import Taro from '@tarojs/taro';
import { Image } from '@tarojs/components';
import { View, Text, Button } from './ui';
export function ReceiptModal({ isOpen, onClose, order, receiptUrls }: any) {
  if (!isOpen || !order) return null;
  const urls = receiptUrls || order.raw?.receiptUrls || [];
  return <View className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <View className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
      <View className="text-center border-b-2 border-dashed border-slate-300 pb-3"><View className="font-bold">采购凭证与代购结算</View><View className="text-[0.625rem] text-slate-400 mt-1">订单 {order.orderId}</View></View>
      <PrivateMedia orderId={order.orderId} kind="receipt" />
      {urls.length ? urls.map((url: string) => <Image key={url} className="w-full" mode="widthFix" src={url} onClick={() => Taro.previewImage({ urls, current: url })} />) : <View className="bg-slate-50 text-xs text-slate-500 p-4 rounded-xl">采购凭证由代购商上传，未显示时可联系商户补充。</View>}
      <View className="text-xs text-slate-500">下单商品明细（称重后以最终结算为准）</View>
      {order.items.map((i: any) => <View key={i.id} className="flex justify-between text-[0.6875rem]"><Text>{i.name} ×{i.quantity}</Text><Text>¥{(i.unitPrice * i.quantity).toFixed(2)}</Text></View>)}
      {([['商品金额', order.subtotal], ['代购服务费', order.proxyFee], ['冷链包装费', order.packagingFee], ['配送费', order.deliveryFee]] as any[]).map(([label, amount]) => <View key={label} className="flex justify-between text-xs"><Text>{label}</Text><Text>¥{amount.toFixed(2)}</Text></View>)}
      <View className="border-t border-dashed border-slate-300 pt-3 text-sm font-bold flex justify-between"><Text>已支付</Text><Text className="text-rose-600">¥{order.totalPaid.toFixed(2)}</Text></View>
      {order.raw?.refundedCents>0&&<View className="text-xs text-emerald-600">已退入余额 ¥{(order.raw.refundedCents/100).toFixed(2)} · 净支出 ¥{((order.raw.paidCents-order.raw.refundedCents)/100).toFixed(2)}</View>}
      <Button className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs" onClick={onClose}>关闭</Button>
    </View>
  </View>;
}
