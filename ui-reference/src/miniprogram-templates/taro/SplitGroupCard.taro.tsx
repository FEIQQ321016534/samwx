/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Taro 跨端组件：山姆拼单进度卡片 (SplitGroupCard.taro.tsx)
 * 适用框架：Taro v3+ (React + TypeScript)
 * 依赖生态：weapp-tailwindcss
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';

export interface Participant {
  id: string;
  nickname: string;
  avatar: string;
  portionName: string;
  joinedAt: string;
  isLeader?: boolean;
}

export interface SplitGroup {
  id: string;
  productId: string;
  productName: string;
  totalSlots: number;
  joinedCount: number;
  pricePerSlot: number;
  slotDescription: string;
  remainingSeconds: number;
  category: string;
  participants: Participant[];
}

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

  const percent = Math.min(100, Math.round((group.joinedCount / group.totalSlots) * 100));
  const remaining = Math.max(0, group.totalSlots - group.joinedCount);
  const isFull = remaining === 0;

  const formatTimer = (seconds: number) => {
    if (seconds <= 0) return '已截单';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}时` : ''}${m < 10 ? '0' : ''}${m}分${s < 10 ? '0' : ''}${s}秒`;
  };

  const handleShareClick = () => {
    if (onShare) {
      onShare(group);
    } else {
      // 触发微信小程序原生转发
      Taro.showShareMenu({
        withShareTicket: true,
      });
    }
  };

  return (
    <View className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col gap-2.5">
      {/* 顶部标签与倒计时 */}
      <View className="flex flex-row items-center justify-between">
        <View className="flex flex-row items-center gap-1.5">
          <View className="bg-amber-100 px-2 py-0.5 rounded">
            <Text className="text-amber-900 text-[10px] font-bold">{group.category}</Text>
          </View>
          <Text className="text-[11px] text-slate-500">{group.slotDescription}</Text>
        </View>

        <View className="bg-amber-50 px-2 py-0.5 rounded-full">
          <Text className="text-[10px] text-amber-700 font-mono">剩 {formatTimer(timeLeft)}</Text>
        </View>
      </View>

      {/* 拼单标题 */}
      <Text className="font-bold text-slate-900 text-sm">{group.productName}</Text>

      {/* 价格与操作按钮区 */}
      <View className="flex flex-row items-center justify-between pt-1">
        <View>
          <Text className="text-[10px] text-slate-400">单人拼单价</Text>
          <View className="flex flex-row items-baseline gap-0.5">
            <Text className="text-base font-bold text-rose-600">¥{group.pricePerSlot.toFixed(1)}</Text>
            <Text className="text-[10px] text-slate-400">/份</Text>
          </View>
        </View>

        {/* 按钮群：分享卡片 & 立即参拼 */}
        <View className="flex flex-row items-center gap-1.5">
          <Button
            openType="share"
            onClick={handleShareClick}
            className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs font-semibold"
          >
            分享拼单
          </Button>

          <Button
            disabled={isFull}
            onClick={() => onJoin(group)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
              isFull
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-500 active:bg-amber-600 text-white'
            }`}
          >
            {isFull ? '已锁单采购' : '立即参拼'}
          </Button>
        </View>
      </View>

      {/* 拼单进度条与成员头像区 */}
      <View className="bg-slate-50 rounded-xl p-2.5 flex flex-col gap-2">
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-1">
            <Text className="text-[11px] text-slate-600">
              团长 <Text className="font-bold text-slate-900">{group.participants[0]?.nickname}</Text> 发起
            </Text>
          </View>
          <Text className={`text-[11px] font-bold ${isFull ? 'text-emerald-600' : 'text-amber-600'}`}>
            {isFull ? '已成团' : `差 ${remaining} 人成团`} ({group.joinedCount}/{group.totalSlots})
          </Text>
        </View>

        {/* 进度条 */}
        <View className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <View
            className={`h-full ${isFull ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${percent}%` }}
          />
        </View>
      </View>
    </View>
  );
};
export default SplitGroupCard;
