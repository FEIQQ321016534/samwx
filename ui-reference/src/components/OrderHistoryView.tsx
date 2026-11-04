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
} from 'lucide-react';

interface OrderHistoryViewProps {
  orders: OrderRecord[];
  onViewTracker: (order: OrderRecord) => void;
  onViewReceipt: (order: OrderRecord) => void;
  onViewQrCode: (order: OrderRecord) => void;
  onReorder: (order: OrderRecord) => void;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orders,
  onViewTracker,
  onViewReceipt,
  onViewQrCode,
  onReorder,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredOrders = filterOrdersByStatus(orders, statusFilter) as OrderRecord[];

  return (
    <div className="space-y-4 pb-20 text-left">
      {/* User Profile & Membership Trust Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 text-slate-900 font-bold flex items-center justify-center text-lg shadow-sm">
              萌
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">王小萌</h3>
                <span className="text-[10px] bg-amber-400/90 text-amber-950 font-bold px-1.5 py-0.2 rounded">
                  山姆邻里拼友
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                绑定社区: 阳光花园东区便民驿站
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xl font-bold text-amber-400 tabular-nums">
              {orders.length}
            </span>
            <span className="text-[10px] text-slate-400 block">累计拼单笔数</span>
          </div>
        </div>

        {/* Value metrics strip */}
        <div className="mt-3.5 pt-3 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">减少分量浪费</span>
            <span className="font-semibold text-white">约 4.6 kg</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">省下大包装溢价</span>
            <span className="font-semibold text-amber-300">¥ 186.00</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">正品与溯源</span>
            <span className="font-semibold text-emerald-400 flex items-center justify-center gap-0.5">
              <ShieldCheck className="w-3 h-3" />
              100%保真
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl text-xs font-semibold">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            statusFilter === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          全部订单 ({orders.length})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            statusFilter === 'active'
              ? 'bg-white text-[#0055A5] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          采购中 / 待提 ({orders.filter((o) => o.status !== 'completed').length})
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            statusFilter === 'completed'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          已完成 ({orders.filter((o) => o.status === 'completed').length})
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-3.5">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-100">
            <Package className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-slate-600 text-sm">暂无此类订单</p>
            <p className="text-xs text-slate-400 mt-1">去挑选山姆招牌商品参与拼单吧</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const badge = getOrderStatusBadge(order.status);
            const isCompleted = order.status === 'completed';

            return (
              <div
                key={order.orderId}
                className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-3 hover:border-blue-100 transition-all text-left"
              >
                {/* Order Card Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs">
                      {order.batchId}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {order.createdAt}
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
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
                  </span>
                </div>

                {/* Items Purchased List */}
                <div className="space-y-2.5">
                  {order.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              it.isSplit
                                ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                : 'bg-blue-50 text-blue-800 border border-blue-200/60'
                            }`}
                          >
                            {it.isSplit ? '拼单分装' : '整件原装'}
                          </span>
                          <h4 className="font-semibold text-slate-900 truncate">
                            {it.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {it.optionName} · {it.weightEstimate}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {formatRMB(it.unitPrice)}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          × {it.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery and Station Info */}
                <div className="bg-slate-50/90 rounded-2xl p-2.5 text-xs text-slate-600 flex items-center justify-between border border-slate-100">
                  <div className="flex items-center gap-2 truncate">
                    {order.deliveryMethod === 'pickup' ? (
                      <MapPin className="w-3.5 h-3.5 text-[#0055A5] shrink-0" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    <span className="truncate text-[11px]">
                      {order.deliveryMethod === 'pickup'
                        ? `自提点: ${order.pickupStation}`
                        : `送达: ${order.deliveryAddress || '送货上门'}`}
                    </span>
                  </div>

                  {order.status !== 'completed' && (
                    <button
                      onClick={() => onViewQrCode(order)}
                      className="text-[#0055A5] font-bold text-[11px] flex items-center gap-0.5 shrink-0 hover:underline"
                    >
                      <QrCode className="w-3 h-3" />
                      <span>提货码 {order.pickupCode}</span>
                    </button>
                  )}
                </div>

                {/* Final Total Breakdown Row */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-400 text-[11px]">
                    含代购费 {formatRMB(order.proxyFee)}
                    {order.packagingFee > 0 && ` + 冷链 ${formatRMB(order.packagingFee)}`}
                    {order.deliveryFee > 0 && ` + 运费 ${formatRMB(order.deliveryFee)}`}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-slate-500 text-[11px]">实付金额:</span>
                    <span className="text-base font-bold text-rose-600 tabular-nums">
                      {formatRMB(order.totalPaid)}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="pt-1 flex items-center justify-end gap-2 text-xs">
                  {/* Digital Receipt Action */}
                  <button
                    onClick={() => onViewReceipt(order)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1 font-medium transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>查看小票</span>
                  </button>

                  {/* If active: view tracker */}
                  {!isCompleted && (
                    <button
                      onClick={() => onViewTracker(order)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#0055A5] font-semibold hover:bg-blue-100 flex items-center gap-1 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>代购实况</span>
                    </button>
                  )}

                  {/* Re-order action */}
                  <button
                    onClick={() => onReorder(order)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0055A5] text-white font-semibold hover:bg-[#004282] active:scale-95 flex items-center gap-1 shadow-xs transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>再次加购</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
