import { Button, View, Text } from './ui';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OrderRecord, Product } from '../types';
import { formatRMB, filterOrdersByStatus, getOrderStatusBadge } from '../utils/orderCalculations';
import {
  Package,
  Clock,
  MapPin,
  FileText,
  QrCode,
  Truck,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
  ExternalLink,
} from './Icons';

interface OrderHistoryViewProps {
  orders: OrderRecord[];
  onViewTracker: (order: OrderRecord) => void;
  onViewReceipt: (order: OrderRecord) => void;
  onViewQrCode: (order: OrderRecord) => void;
  onReorder: (order: OrderRecord) => void;
  onCancel?: (order: OrderRecord) => void;
  onAfterSales?: (order: OrderRecord) => void;
  onPay?: (order: OrderRecord) => void;
  onTopup?: (order: OrderRecord, method: string) => void;
  devPaymentsEnabled?: boolean;
  testPaymentsEnabled?: boolean;
  uatEnabled?: boolean;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orders,
  onViewTracker,
  onViewReceipt,
  onViewQrCode,
  onReorder, onCancel, onAfterSales, onPay, onTopup, devPaymentsEnabled, testPaymentsEnabled, uatEnabled,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredOrders = filterOrdersByStatus(orders, statusFilter) as OrderRecord[];

  return (
    <View className="space-y-4 pb-20 text-left">
      {/* User Profile & Membership Trust Header */}
      <View className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <View className="flex items-center justify-between gap-3 relative z-10">
          <View className="flex items-center gap-3">
            <View className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-900 font-bold flex items-center justify-center text-lg shadow-sm">
              我
            </View>
            <View>
              <View className="flex items-center gap-2">
                <View className="font-bold text-base text-white">我的订单</View>
                <Text className="text-[0.625rem] bg-amber-400/90 text-amber-950 font-bold px-1.5 py-0.2 rounded">
                  山姆邻里拼友
                </Text>
              </View>
              <View className="text-xs text-slate-300 mt-0.5">
                烟台同城 · 多代购商服务
              </View>
            </View>
          </View>

          <View className="text-right">
            <Text className="text-xl font-bold text-amber-400 tabular-nums">
              {orders.length}
            </Text>
            <Text className="text-[0.625rem] text-slate-400 block">累计拼单笔数</Text>
          </View>
        </View>

        {/* Value metrics strip */}
        <View className="mt-3.5 pt-3 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-center text-xs">
          <View>
            <Text className="text-[0.625rem] text-slate-400 block">累计拼份</Text>
            <Text className="font-semibold text-white">{orders.reduce((sum, o) => sum + o.items.filter((i) => i.isSplit).reduce((n, i) => n + i.quantity, 0), 0)} 份拼单</Text>
          </View>
          <View>
            <Text className="text-[0.625rem] text-slate-400 block">累计付款</Text>
            <Text className="font-semibold text-amber-300">¥ {orders.reduce((s, o) => s + o.totalPaid, 0).toFixed(2)}</Text>
          </View>
          <View>
            <Text className="text-[0.625rem] text-slate-400 block">正品与溯源</Text>
            <Text className="font-semibold text-emerald-400 flex items-center justify-center gap-0.5">
              <ShieldCheck className="w-3 h-3" />
              小票可查
            </Text>
          </View>
        </View>
      </View>

      {uatEnabled && <View className="bg-amber-50 text-amber-900 rounded-xl p-3 text-xs">本页均为线上测试订单，不涉及真实资金或履约。</View>}
      {/* Filter Tabs */}
      <View className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl text-xs font-semibold">
        <Button
          onClick={() => setStatusFilter('all')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            statusFilter === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          全部订单 ({orders.length})
        </Button>
        <Button
          onClick={() => setStatusFilter('active')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            statusFilter === 'active'
              ? 'bg-white text-[#0055A5] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          采购中 / 待提 ({filterOrdersByStatus(orders, 'active').length})
        </Button>
        <Button
          onClick={() => setStatusFilter('completed')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            statusFilter === 'completed'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          已完成 ({orders.filter((o) => o.status === 'completed').length})
        </Button>
      </View>

      {/* Orders List */}
      <View className="space-y-3.5">
        {filteredOrders.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-100">
            <Package className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <View className="font-medium text-slate-600 text-sm">暂无此类订单</View>
            <View className="text-xs text-slate-400 mt-1">去挑选山姆招牌商品参与拼单吧</View>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const badge = getOrderStatusBadge(order.status);
            const isCompleted = order.status === 'completed';

            return (
              <View
                key={order.orderId}
                className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-3 hover:border-blue-100 transition-all text-left"
              >
                {/* Order Card Header */}
                <View className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
                  <View className="flex items-center gap-2">
                    <Text className="font-bold text-slate-800 text-xs">
                      {order.batchId}
                    </Text>
                    <Text className="text-[0.625rem] text-slate-400 font-mono">
                      {order.createdAt}
                    </Text>
                  </View>

                  <Text
                    className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${
                      badge.variant === 'amber'
                        ? 'bg-amber-100 text-amber-800'
                        : badge.variant === 'emerald'
                        ? 'bg-emerald-100 text-emerald-800'
                        : badge.variant === 'blue'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {badge.label}
                  </Text>
                </View>

                {/* Items Purchased List */}
                <View className="space-y-2.5">
                  {order.items.map((it) => (
                    <View
                      key={it.id}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <View className="min-w-0 flex-1">
                        <View className="flex items-center gap-1.5">
                          <Text
                            className={`text-[0.625rem] font-bold px-1.5 py-0.2 rounded ${
                              it.isSplit
                                ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                : 'bg-blue-50 text-blue-800 border border-blue-200/60'
                            }`}
                          >
                            {it.isSplit ? '拼单分装' : '整件原装'}
                          </Text>
                          <View className="font-semibold text-slate-900 truncate">
                            {it.name}
                          </View>
                        </View>
                        <View className="text-[0.6875rem] text-slate-400 mt-0.5">
                          {it.optionName} · {it.weightEstimate}
                          {(it.cancelledQuantity || 0) > 0 && <Text className="text-rose-600"> · 已取消{it.cancelledQuantity}份</Text>}
                        </View>
                      </View>

                      <View className="text-right shrink-0">
                        <Text className="font-semibold text-slate-900 tabular-nums">
                          {formatRMB(it.unitPrice)}
                        </Text>
                        <Text className="text-[0.6875rem] text-slate-400 block">
                          × {it.quantity}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Delivery and Station Info */}
                <View className="bg-slate-50/90 rounded-2xl p-2.5 text-xs text-slate-600 flex items-center justify-between border border-slate-100">
                  <View className="flex items-center gap-2 truncate">
                    {order.deliveryMethod === 'pickup' ? (
                      <MapPin className="w-3.5 h-3.5 text-[#0055A5] shrink-0" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    <Text className="truncate text-[0.6875rem]">
                      {order.deliveryMethod === 'pickup'
                        ? `自提点: ${order.pickupStation}`
                        : `送达: ${order.deliveryAddress || '送货上门'}`}
                    </Text>
                  </View>

                  {order.deliveryMethod === 'pickup' && order.pickupCode && order.status === 'ready_for_pickup' && (
                    <Button
                      onClick={() => onViewQrCode(order)}
                      className="text-[#0055A5] font-bold text-[0.6875rem] flex items-center gap-0.5 shrink-0 hover:underline"
                    >
                      <QrCode className="w-3 h-3" />
                      <Text>提货码 {order.pickupCode}</Text>
                    </Button>
                  )}
                </View>

                {/* Final Total Breakdown Row */}
                <View className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <View className="text-slate-400 text-[0.6875rem]">
                    含代购费 {formatRMB(order.proxyFee)}
                    {order.packagingFee > 0 && ` + 冷链 ${formatRMB(order.packagingFee)}`}
                    {order.deliveryFee > 0 && ` + 运费 ${formatRMB(order.deliveryFee)}`}
                  </View>

                  <View className="flex items-baseline gap-1">
                    <Text className="text-slate-500 text-[0.6875rem]">累计付款:</Text>
                    <Text className="text-base font-bold text-rose-600 tabular-nums">
                      {formatRMB(order.totalPaid)}
                    </Text>
                  </View>
                </View>

                {order.status === 'unpaid' && <Button className="w-full py-2 bg-amber-500 text-white rounded-xl text-xs" onClick={() => onPay?.(order)}>继续付款 ¥{((order.raw?.pricing?.totalCents || 0) / 100).toFixed(2)}</Button>}
                {order.raw?.topupCents > 0 && <View className="bg-amber-50 p-3 rounded-xl space-y-2"><View className="text-xs text-amber-900">称重待补差价 ¥{(order.raw.topupCents / 100).toFixed(2)}</View><View className="flex gap-2"><Button className="text-xs text-[#0055A5]" onClick={() => onTopup?.(order, 'wallet')}>余额补款</Button><Button className="text-xs text-[#07C160]" onClick={() => onTopup?.(order, 'wechat')}>微信补款</Button>{testPaymentsEnabled && <Button className="text-xs text-amber-700" onClick={() => onTopup?.(order, 'test')}>模拟补款</Button>}{devPaymentsEnabled && <Button className="text-xs text-amber-700" onClick={() => onTopup?.(order, 'dev')}>测试补款</Button>}</View></View>}
                {order.raw?.refundedCents > 0 && <View className="text-xs text-emerald-600">已退入账户余额 ¥{(order.raw.refundedCents / 100).toFixed(2)} · 净支出 ¥{((order.raw.paidCents-order.raw.refundedCents)/100).toFixed(2)}</View>}
                <View className="flex gap-3 text-xs justify-end">
                  {order.status==='unpaid'&&<Button className="text-slate-500" onClick={()=>onCancel?.(order)}>取消订单</Button>}
                  {order.raw?.paidAt&&<Button className="text-[#0055A5]" onClick={()=>onAfterSales?.(order)}>申请 / 查看售后</Button>}
                </View>
                {/* Bottom Actions Row */}
                <View className="pt-1 flex items-center justify-end gap-2 text-xs">
                  {/* Digital Receipt Action */}
                  <Button
                    onClick={() => onViewReceipt(order)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1 font-medium transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <Text>查看小票</Text>
                  </Button>

                  {/* If active: view tracker */}
                  {!isCompleted && (
                    <Button
                      onClick={() => onViewTracker(order)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#0055A5] font-semibold hover:bg-blue-100 flex items-center gap-1 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <Text>代购实况</Text>
                    </Button>
                  )}

                  {/* Re-order action */}
                  <Button
                    onClick={() => onReorder(order)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0055A5] text-white font-semibold hover:bg-[#004282] active:scale-95 flex items-center gap-1 shadow-xs transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <Text>再次加购</Text>
                  </Button>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
};
