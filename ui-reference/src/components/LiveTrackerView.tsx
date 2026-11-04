/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShoppingMilestone, OrderRecord } from '../types';
import { SHOPPING_BATCH_INFO } from '../data/mockData';
import { formatRMB } from '../utils/orderCalculations';
import {
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Camera,
  QrCode,
  Truck,
  Sparkles,
  ChevronRight,
  Package,
  Copy,
  Check,
  RotateCw,
} from 'lucide-react';

interface LiveTrackerViewProps {
  orders: OrderRecord[];
  milestones: ShoppingMilestone[];
  onAdvanceMilestone?: () => void;
  onResetMilestones?: () => void;
}

export const LiveTrackerView: React.FC<LiveTrackerViewProps> = ({
  orders,
  milestones,
  onAdvanceMilestone,
  onResetMilestones,
}) => {
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState<'cart' | 'packaging' | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const activeOrder = orders[0];

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-4 pb-20 text-left">
      {/* Current Active Batch Status Card */}
      <div className="bg-gradient-to-br from-[#0055A5] to-[#003870] rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        {/* Subtle background graphics */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-2 right-4 text-[10px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded-full">
          实时采购中
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-blue-200">{SHOPPING_BATCH_INFO.storeName}</span>
        </div>

        <h3 className="text-base sm:text-lg font-bold">
          {SHOPPING_BATCH_INFO.batchNumber}
        </h3>

        {/* Schedule grid */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/15 text-xs">
          <div>
            <span className="text-blue-200 text-[10px] block">发车采购时间</span>
            <span className="font-semibold">{SHOPPING_BATCH_INFO.departureTime}</span>
          </div>
          <div>
            <span className="text-blue-200 text-[10px] block">预计自提时间</span>
            <span className="font-semibold text-amber-300">
              {SHOPPING_BATCH_INFO.estimatedPickupTime}
            </span>
          </div>
        </div>

        {/* Shopper profile & vehicle */}
        <div className="mt-3 bg-black/20 backdrop-blur-xs rounded-2xl p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-amber-950 font-bold flex items-center justify-center text-xs">
              老陈
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <span>{SHOPPING_BATCH_INFO.shopperName}</span>
                <span className="text-[10px] bg-blue-600/60 px-1.5 py-0.2 rounded text-blue-100">
                  {SHOPPING_BATCH_INFO.shopperVehicle}
                </span>
              </div>
              <span className="text-[10px] text-blue-200">
                10年山姆资深卓越会员 · 恒温冷柜运输
              </span>
            </div>
          </div>

          <a
            href={`tel:${SHOPPING_BATCH_INFO.shopperPhone}`}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center justify-center"
            title="联系团长"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* User Pickup Code Quick Card */}
      {activeOrder && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQrModal(true)}
              className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center justify-center text-[#0055A5] hover:bg-blue-100 transition-colors shrink-0"
              title="查看自提二维码"
            >
              <QrCode className="w-6 h-6" />
              <span className="text-[9px] font-bold mt-0.5">扫码自提</span>
            </button>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900">
                  社区自提提货码:
                </span>
                <span className="font-mono font-bold text-base text-rose-600">
                  {activeOrder.pickupCode}
                </span>
                <button
                  onClick={() => handleCopyCode(activeOrder.pickupCode)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                  title="复制自提码"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                自提点: {activeOrder.pickupStation}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowQrModal(true)}
            className="text-xs font-semibold text-[#0055A5] hover:underline shrink-0"
          >
            核验凭证 ▾
          </button>
        </div>
      )}

      {/* Transparency Actions Bar (Receipt & In-Store Photo) */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setShowReceiptModal(true)}
          className="bg-white hover:bg-blue-50/50 active:scale-98 p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5 text-left transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block truncate">
              山姆纸质小票明细
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              现场收银扣款原件
            </span>
          </div>
        </button>

        <button
          onClick={() => setShowPhotoModal('cart')}
          className="bg-white hover:bg-blue-50/50 active:scale-98 p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5 text-left transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0055A5] flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block truncate">
              卖场实拍与推车
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              现场选品透明溯源
            </span>
          </div>
        </button>
      </div>

      {/* Real-time Shopping Milestone Timeline */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">代购全流程实况追踪</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">每一步均由团长现场打卡核验</p>
          </div>

          {/* Test simulation button to advance status */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAdvanceMilestone}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-[#0055A5] rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
              title="模拟采购员推进状态"
            >
              <RotateCw className="w-3 h-3" />
              <span>推进下一步</span>
            </button>
          </div>
        </div>

        {/* Milestone Steps */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {milestones.map((ms, index) => {
            const isCompleted = ms.status === 'completed';
            const isCurrent = ms.status === 'current';

            return (
              <div key={ms.id} className="relative group">
                {/* Step Marker Dot */}
                <div
                  className={`absolute -left-6 top-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold z-10 ${
                    isCompleted
                      ? 'bg-[#0055A5] border-[#0055A5] text-white'
                      : isCurrent
                      ? 'bg-amber-500 border-amber-200 text-white ring-4 ring-amber-100 animate-pulse'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? '✓' : ms.stepNumber}
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center justify-between">
                    <h5
                      className={`text-xs font-bold ${
                        isCurrent
                          ? 'text-amber-700'
                          : isCompleted
                          ? 'text-slate-900'
                          : 'text-slate-400'
                      }`}
                    >
                      {ms.title}
                    </h5>
                    <span className="text-[10px] font-mono text-slate-400">{ms.time}</span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {ms.description}
                  </p>

                  {/* Field shopper note if present */}
                  {ms.shopperNote && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                        isCurrent
                          ? 'bg-amber-50/80 text-amber-900 border border-amber-200/60'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-semibold">现场播报: </span>
                        {ms.shopperNote}
                      </div>
                    </div>
                  )}

                  {/* Attachment triggers */}
                  {ms.hasPhoto && isCurrent && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setShowPhotoModal('cart')}
                        className="text-[11px] text-[#0055A5] font-semibold flex items-center gap-1 hover:underline"
                      >
                        <Camera className="w-3 h-3" />
                        <span>查看现场实拍照片 (2张)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Orders Item Summary */}
      {activeOrder && (
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <span className="text-xs font-bold text-slate-900">
                订单编号: {activeOrder.orderId}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                下单时间: {activeOrder.createdAt}
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              已完成微信支付
            </span>
          </div>

          <div className="space-y-2">
            {activeOrder.items.map((it) => (
              <div key={it.id} className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-slate-800">{it.name}</span>
                  <div className="text-[10px] text-slate-400">
                    {it.optionName} · {it.weightEstimate} × {it.quantity}
                  </div>
                </div>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatRMB(it.unitPrice * it.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>实付总计 (含代购费与打包费)</span>
            <span className="text-sm font-bold text-rose-600 tabular-nums">
              {formatRMB(activeOrder.totalPaid)}
            </span>
          </div>
        </div>
      )}

      {/* Modal: Digital Supermarket Printed Receipt */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl p-5 text-slate-800 font-mono text-xs space-y-3 relative"
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
                交易时间: 2026-11-03 14:35:12
              </p>
            </div>

            {/* Receipt Table */}
            <div className="space-y-1.5 py-1 border-b border-dashed border-slate-300 text-[11px]">
              <div className="flex justify-between font-bold text-slate-700">
                <span>品名/条码</span>
                <span>单价×数量 金额</span>
              </div>
              <div className="flex justify-between">
                <span>MM 伯爵瑞士卷 16P</span>
                <span>68.00 × 1 = 68.00</span>
              </div>
              <div className="flex justify-between">
                <span>MM 小青柠复合果汁 2L</span>
                <span>39.90 × 1 = 39.90</span>
              </div>
              <div className="flex justify-between">
                <span>澳洲谷饲西冷牛排 1.2k</span>
                <span>169.00 × 1 = 169.00</span>
              </div>
            </div>

            {/* Receipt Totals */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>合计应收</span>
                <span className="font-bold">¥ 276.90</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>付款方式: 微信会员卡闪付</span>
                <span>实收: ¥276.90</span>
              </div>
            </div>

            {/* Barcode Graphic */}
            <div className="pt-2 flex flex-col items-center">
              <div className="h-10 w-4/5 bg-slate-800 flex items-center justify-center text-white text-[10px] tracking-[6px] font-mono">
                |||||||||||||||||||||||||||||
              </div>
              <span className="text-[9px] text-slate-400 mt-1">
                8820 1103 9942 0182
              </span>
            </div>

            <button
              onClick={() => setShowReceiptModal(false)}
              className="w-full mt-2 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              关闭小票凭证
            </button>
          </div>
        </div>
      )}

      {/* Modal: Live Camera & Packaging Inspection */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl p-5 text-left space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {showPhotoModal === 'cart' ? '卖场推车与选品现场' : '无菌分装台'}
                </h4>
                <p className="text-[11px] text-slate-400">拍摄于今日 14:26 · 山姆烘焙与生鲜区</p>
              </div>
              <button
                onClick={() => setShowPhotoModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            {/* Visual presentation */}
            <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video relative flex items-center justify-center border border-slate-200">
              {/* Illustrated simulation of warehouse shopping cart */}
              <div className="w-full h-full bg-gradient-to-tr from-slate-800 via-slate-700 to-slate-900 p-4 flex flex-col justify-between text-white">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="bg-red-600 px-2 py-0.5 rounded font-bold">● LIVE 现场打卡</span>
                  <span className="text-slate-300 font-mono">14:26:08</span>
                </div>

                <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>瑞士卷与熟食烤鸡已装入车载保温冰柜</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-snug">
                    "已仔细挑选新鲜批次，瑞士卷出炉时间为上午11点，奶油饱满，全程加装4个干冰保鲜袋！"
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              每笔采购均严格记录批次时间，如对保质期或成色有疑问，可随时联系团长调换。
            </p>

            <button
              onClick={() => setShowPhotoModal(null)}
              className="w-full py-2.5 bg-[#0055A5] text-white rounded-xl text-xs font-semibold hover:bg-[#004282] transition-colors"
            >
              确认并返回追踪
            </button>
          </div>
        </div>
      )}

      {/* Modal: Pickup QR Code */}
      {showQrModal && activeOrder && (
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
                {activeOrder.pickupStation}
              </p>
            </div>

            {/* Simulated QR Code SVG */}
            <div className="w-48 h-48 mx-auto bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner">
              <svg className="w-full h-full text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                {/* QR corner 1 */}
                <rect x="5" y="5" width="25" height="25" rx="3" fill="#0055A5" />
                <rect x="10" y="10" width="15" height="15" fill="white" />
                <rect x="13" y="13" width="9" height="9" fill="#0055A5" />
                {/* QR corner 2 */}
                <rect x="70" y="5" width="25" height="25" rx="3" fill="#0055A5" />
                <rect x="75" y="10" width="15" height="15" fill="white" />
                <rect x="78" y="13" width="9" height="9" fill="#0055A5" />
                {/* QR corner 3 */}
                <rect x="5" y="70" width="25" height="25" rx="3" fill="#0055A5" />
                <rect x="10" y="75" width="15" height="15" fill="white" />
                <rect x="13" y="78" width="9" height="9" fill="#0055A5" />
                {/* QR Data Pattern dots */}
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

            <div className="bg-slate-50 py-2 px-4 rounded-xl inline-block">
              <span className="text-xs text-slate-400 block">提货验证码</span>
              <span className="font-mono text-2xl font-bold text-rose-600 tracking-wider">
                {activeOrder.pickupCode}
              </span>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              关闭返回
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
