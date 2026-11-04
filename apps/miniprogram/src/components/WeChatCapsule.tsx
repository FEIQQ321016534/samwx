import { Button, View, Text } from './ui';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MapPin, ChevronDown, Bell, ShieldCheck } from './Icons';


interface WeChatCapsuleProps {
  currentCommunity: string;
  onSelectCommunity: (name: string) => void;
  cartCount: number;
  onOpenCart: () => void;
}

export const WeChatCapsule: React.FC<WeChatCapsuleProps> = ({
  currentCommunity,
  onSelectCommunity,
  cartCount,
  onOpenCart,
}) => {
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <View className="sticky top-0 z-40 bg-[#0055A5] text-white shadow-md">
      <View className="mini-status-space" />
      {/* Mini Program Header & WeChat Capsule Area */}
      <View className="flex items-center justify-between px-3 py-2 mini-header">
        {/* Neighborhood Community Station Selector */}
        <View className="relative">
          <Button
            onClick={() => onSelectCommunity(currentCommunity)}
            className="flex items-center gap-1.5 bg-black/25 hover:bg-black/35 active:scale-95 transition-all px-2.5 py-1.5 rounded-full text-left"
            aria-label="选择自提社区"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <View className="truncate max-w-[8.75rem] xs:max-w-[11.25rem]">
              <Text className="text-xs font-semibold block leading-tight text-white truncate">
                {currentCommunity}
              </Text>
              <Text className="text-[0.625rem] text-blue-100 block leading-none truncate">
                便民自提驿站
              </Text>
            </View>
            <ChevronDown className="w-3 h-3 text-white/70 shrink-0 ml-0.5" />
          </Button>


        </View>


      </View>

      {/* Trust & Dispatch Ribbon */}
      <View className="bg-[#004282] px-3.5 py-1.5 text-[0.6875rem] text-blue-100 flex items-center justify-between">
        <View className="flex items-center gap-2 truncate">
          <Text className="bg-amber-400 text-amber-950 text-[0.625rem] font-bold px-1.5 py-0.2 rounded-xs">
            采购专班
          </Text>
          <Text className="truncate">烟台同城代购 · 按批次采购配送</Text>
        </View>
        <View className="text-[0.6875rem] text-amber-300 font-medium shrink-0 ml-2">
          满199免保温冷链费
        </View>
      </View>
    </View>
  );
};
