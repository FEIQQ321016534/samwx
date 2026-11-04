import { PrivateMedia } from './PrivateMedia';
import { formatBeijingDate } from '../services/api';
import React, { useState } from 'react';
import Taro from '@tarojs/taro';
import { Image } from '@tarojs/components';
import { View, Text, Button } from './ui';
import { ReceiptModal } from './ReceiptModal';
import { PickupQrModal } from './PickupQrModal';
import { Clock, Truck, FileText, QrCode, CheckCircle2 } from './Icons';
import { getOrderStatusBadge } from '../utils/orderCalculations';

export function LiveTrackerView({ orders, catalog, merchantId, onResetMilestones }: any) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const order = orders.find((o: any) => !['unpaid', 'cancelled', 'refunded', 'completed'].includes(o.status)) || orders[0];
  const raw = order?.raw;
  const batch = raw?.batchSnapshot || catalog.batches.find((b: any) => b.id === raw?.batchId) || catalog.batches.find((b: any) => b.merchantId === merchantId && b.status === 'open');
  const receipts = Array.from(new Set([...(raw?.receiptUrls || []), ...(batch?.receiptUrls || [])])) as string[];
  const photos = Array.from(new Set([...(raw?.photoUrls || []), ...(batch?.photoUrls || [])])) as string[];
  const formatTime = (s?: string) => s ? formatBeijingDate(s) : '待代购商发布';
  const steps = [
    { title: '订单汇总截单 · 清单核验', key: 'paid' },
    { title: '团长入店选品 · 现场采购', key: 'purchasing' },
    { title: '分装称重 · 核算多退少补', key: 'portioning' },
    { title: '送达自提点 / 骑手派送', key: raw?.fulfillment === 'delivery' ? 'delivering' : 'ready_for_pickup' },
    { title: '提货 / 配送完成', key: 'completed' },
  ];
  return <View className="space-y-4 pb-20 text-left">
    <View className="bg-gradient-to-br from-[#0055A5] to-[#003870] rounded-3xl p-4 text-white shadow-md">
      <View className="flex justify-between"><Text className="text-xs text-blue-200">{batch?.storeName || '烟台同城采购'}</Text><Text className="text-[0.625rem] text-amber-300">{order ? getOrderStatusBadge(order.status).label : '采购批次'}</Text></View>
      <View className="font-bold text-base mt-2">{batch?.title || '暂无进行中的采购批次'}</View>
      <View className="grid grid-cols-2 gap-2 border-t border-white/20 mt-3 pt-3 text-xs"><View><View className="text-[0.625rem] text-blue-200">批次截单时间</View><View>{formatTime(batch?.cutoffAt)}</View></View><View><View className="text-[0.625rem] text-blue-200">预计自提时间</View><View className="text-amber-200">{formatTime(batch?.pickupStartAt)}</View></View></View>
      {batch?.shopperName && <View className="mt-3 text-[0.6875rem] text-blue-100">采购人：{batch.shopperName}　{batch.shopperPhone}</View>}
    </View>
    {!order && <View className="bg-white border border-slate-100 rounded-2xl p-5 text-center text-xs text-slate-500">下单付款后，可在这里查看对应订单的真实采购进度。</View>}
    {order && <View className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
      <View className="flex items-center gap-2 text-sm font-bold"><Truck className="w-4 h-4 text-[#0055A5]" /><Text>我的本期订单</Text></View>
      <View className="text-[0.6875rem] text-slate-400">{order.orderId}</View><View className="text-xs">{raw.fulfillment === 'delivery' ? `配送地址：${raw.address}` : `自提点：${order.pickupStation}`}</View>
      {raw.topupCents > 0 && <View className="text-xs text-rose-600">称重后待补差价 ¥{(raw.topupCents / 100).toFixed(2)}，请至历史订单完成补款。</View>}
      <View className="flex gap-2"><Button className="flex-1 bg-blue-50 text-[#0055A5] py-2 rounded-xl text-xs flex gap-1 justify-center items-center" onClick={() => setShowReceipt(true)}><FileText className="w-4 h-4 text-[#0055A5]" /><Text>采购小票</Text></Button>
        {raw.fulfillment === 'pickup' && order.pickupCode && <Button className="flex-1 bg-amber-50 text-amber-800 py-2 rounded-xl text-xs flex gap-1 justify-center items-center" onClick={() => setShowQr(true)}><QrCode className="w-4 h-4 text-amber-700" /><Text>出示提货码</Text></Button>}</View>
    </View>}
    <View className="bg-white rounded-3xl border border-slate-100 p-4 space-y-4">
      <View className="flex justify-between items-center"><View className="font-bold text-sm">代购实况时间线</View><Button className="text-xs text-[#0055A5]" onClick={onResetMilestones}>刷新</Button></View>
      {steps.map((step, i) => {
        const entry = raw?.progress?.filter((p: any) => p.status === step.key).at(-1);
        return <View key={step.key} className="flex gap-3"><View className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs ${entry ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{entry ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : i + 1}</View><View className="flex-1 border-b border-slate-100 pb-4"><View className="font-bold text-xs">{step.title}</View><View className="text-[0.625rem] text-slate-400 mt-1">{entry ? formatTime(entry.at) : '等待更新'}</View>{entry?.note && <View className="bg-blue-50 rounded-xl p-2 text-[0.6875rem] text-slate-600 mt-2">{entry.note}</View>}</View></View>;
      })}
    </View>
    <View className="bg-white rounded-2xl p-4 border border-slate-100"><View className="text-sm font-bold mb-3">现场照片</View><PrivateMedia orderId={order?.orderId} kind="photo" />{photos.length ? <View className="grid grid-cols-2 gap-2">{photos.map((url) => <Image key={url} src={url} mode="aspectFill" className="w-full h-32 rounded-xl" onClick={() => Taro.previewImage({ urls: photos, current: url })} />)}</View> : <View className="text-xs text-slate-400">现场记录以代购商上传内容为准。</View>}</View>
    <ReceiptModal isOpen={showReceipt} onClose={() => setShowReceipt(false)} order={order} receiptUrls={receipts} />
    <PickupQrModal isOpen={showQr} onClose={() => setShowQr(false)} order={order} />
  </View>;
}
