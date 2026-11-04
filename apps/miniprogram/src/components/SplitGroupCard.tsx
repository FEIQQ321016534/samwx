import { Button, View, Text } from './ui';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SplitGroup } from '../types';
import { calculateGroupProgress, formatRMB } from '../utils/orderCalculations';
import { Users, Clock, Flame, ChevronRight, CheckCircle2, Share2 } from './Icons';

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
    <View className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs hover:border-amber-200 transition-all flex flex-col gap-2.5 relative overflow-hidden">
      {/* Top Banner Tag & Countdown */}
      <View className="flex items-center justify-between gap-2">
        <View className="flex items-center gap-1.5 min-w-0">
          <Text className="bg-amber-100 text-amber-900 text-[0.625rem] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Flame className="w-3 h-3 text-amber-600" />
            {group.category}
          </Text>
          <Text className="text-[0.6875rem] text-slate-500 font-medium truncate">
            {group.slotDescription}
          </Text>
        </View>

        {/* Countdown */}
        <View className="flex items-center gap-1 text-[0.625rem] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-mono font-medium shrink-0">
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <Text>{formatTimer(timeLeft)}</Text>
        </View>
      </View>

      {/* Title */}
      <View>
        <View className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
          {group.productName}
        </View>
      </View>

      {/* Price and CTA in one well-spaced row */}
      <View className="flex items-center justify-between gap-2 pt-0.5">
        <View>
          <Text className="text-[0.625rem] text-slate-400">单人拼单价</Text>
          <View className="flex items-baseline gap-1">
            <Text className="text-base font-bold text-rose-600 tabular-nums">
              {formatRMB(group.pricePerSlot)}
            </Text>
            <Text className="text-[0.625rem] text-slate-400">/份</Text>
          </View>
        </View>

        {/* Action Buttons: Share & Join */}
        <View className="flex items-center gap-1.5 shrink-0">
          {onShare && (
            <Button
              onClick={() => onShare(group)}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
              title="生成微信小程序卡片分享"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-700" />
              <Text>分享</Text>
            </Button>
          )}

          <Button
            onClick={() => onJoin(group)}
            disabled={isFull || timeLeft <= 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition-all ${
              isFull
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
            }`}
          >
            {isFull ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <Text>已锁单</Text>
              </>
            ) : (
              <>
                <Text>立即参拼</Text>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </View>
      </View>

      {/* Progress & Participant Avatars */}
      <View className="bg-slate-50 rounded-xl p-2.5 flex flex-col gap-2 border border-slate-100">
        <View className="flex items-center justify-between text-xs">
          {/* Avatar stack */}
          <View className="flex items-center gap-1.5">
            <View className="flex -space-x-1.5 items-center">
              {group.participants.map((p, idx) => (
                <View
                  key={idx}
                  className="w-6 h-6 rounded-full bg-amber-200 border-2 border-white flex items-center justify-center text-xs shadow-xs"
                  title={`${p.nickname} (${p.portionName})`}
                >
                  {p.avatar}
                </View>
              ))}
              {/* Empty placeholder slots */}
              {Array.from({ length: Math.max(0, group.totalSlots - group.joinedCount) }).map(
                (_, idx) => (
                  <View
                    key={`empty-${idx}`}
                    className="w-6 h-6 rounded-full border border-dashed border-slate-300 bg-white flex items-center justify-center text-[0.625rem] text-slate-400"
                    title="待邻居加入"
                  >
                    ?
                  </View>
                )
              )}
            </View>

            <Text className="text-[0.6875rem] text-slate-600 font-medium">
              团长 <Text className="text-slate-900 font-semibold">{group.participants[0]?.nickname}</Text> 发起
            </Text>
          </View>

          {/* Status Label */}
          <Text
            className={`text-[0.6875rem] font-semibold ${
              isFull ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {statusLabel} ({group.joinedCount}/{group.totalSlots})
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="w-full bg-slate-200 h-2 rounded-full overflow-hidden relative">
          <View
            className={`h-full rounded-full transition-all duration-500 ${
              isFull
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-amber-400 to-orange-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </View>
      </View>
    </View>
  );
};
