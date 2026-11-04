/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SplitGroup } from '../types';
import { calculateGroupProgress, formatRMB } from '../utils/orderCalculations';
import { Users, Clock, Flame, ChevronRight, CheckCircle2, Share2 } from 'lucide-react';

interface SplitGroupCardProps {
  group: SplitGroup;
  onJoin: (group: SplitGroup) => void;
  onShare?: (group: SplitGroup) => void;
}

export const SplitGroupCard: React.FC<SplitGroupCardProps> = ({ group, onJoin, onShare }) => {
  const [timeLeft, setTimeLeft] = useState(group.remainingSeconds);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const { percent, remaining, isFull, statusLabel } = calculateGroupProgress(
    group.joinedCount,
    group.totalSlots
  );

  const formatTimer = (seconds: number) => {
    if (seconds <= 0) return '已截单';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}时` : ''}${m < 10 ? '0' : ''}${m}分${s < 10 ? '0' : ''}${s}秒`;
  };

  return (
    <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs hover:border-amber-200 transition-all flex flex-col gap-2.5 relative overflow-hidden">
      {/* Top Banner Tag & Countdown */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Flame className="w-3 h-3 text-amber-600" />
            {group.category}
          </span>
          <span className="text-[11px] text-slate-500 font-medium truncate">
            {group.slotDescription}
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-mono font-medium shrink-0">
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{formatTimer(timeLeft)}</span>
        </div>
      </div>

      {/* Title */}
      <div>
        <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
          {group.productName}
        </h4>
      </div>

      {/* Price and CTA in one well-spaced row */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div>
          <span className="text-[10px] text-slate-400">单人拼单价</span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-rose-600 tabular-nums">
              {formatRMB(group.pricePerSlot)}
            </span>
            <span className="text-[10px] text-slate-400">/份</span>
          </div>
        </div>

        {/* Action Buttons: Share & Join */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onShare && (
            <button
              onClick={() => onShare(group)}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
              title="生成微信小程序卡片分享"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-700" />
              <span>分享</span>
            </button>
          )}

          <button
            onClick={() => onJoin(group)}
            disabled={isFull}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all ${
              isFull
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
            }`}
          >
            {isFull ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>已锁单</span>
              </>
            ) : (
              <>
                <span>立即参拼</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress & Participant Avatars */}
      <div className="bg-slate-50 rounded-xl p-2.5 flex flex-col gap-2 border border-slate-100">
        <div className="flex items-center justify-between text-xs">
          {/* Avatar stack */}
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5 items-center">
              {group.participants.map((p, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full bg-amber-200 border-2 border-white flex items-center justify-center text-xs shadow-xs"
                  title={`${p.nickname} (${p.portionName})`}
                >
                  {p.avatar}
                </div>
              ))}
              {/* Empty placeholder slots */}
              {Array.from({ length: Math.max(0, group.totalSlots - group.joinedCount) }).map(
                (_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="w-6 h-6 rounded-full border border-dashed border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400"
                    title="待邻居加入"
                  >
                    ?
                  </div>
                )
              )}
            </div>

            <span className="text-[11px] text-slate-600 font-medium">
              团长 <span className="text-slate-900 font-semibold">{group.participants[0]?.nickname}</span> 发起
            </span>
          </div>

          {/* Status Label */}
          <span
            className={`text-[11px] font-semibold ${
              isFull ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {statusLabel} ({group.joinedCount}/{group.totalSlots})
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFull
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-amber-400 to-orange-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
