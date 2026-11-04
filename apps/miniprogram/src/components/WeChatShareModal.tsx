import React from 'react';
import { View, Text, Button } from './ui';
import { ProductArtwork } from './ProductArtwork';
import { X } from './Icons';
export function WeChatShareModal({ group, product, currentCommunity, onClose, onJoin }: any) {
  if (!group) return null;
  const remaining = Math.max(0, group.totalSlots - group.joinedCount);
  return <View className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <View className="w-full max-w-sm bg-white rounded-3xl overflow-hidden">
      <View className="p-4 flex justify-between"><Text className="font-bold text-sm">邀请邻里一起拼</Text><Button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></Button></View>
      <ProductArtwork type={product?.iconType || 'bakery'} name={group.productName} aspectRatio="16:9" />
      <View className="p-4 space-y-3"><View className="font-bold">{group.productName}</View><View className="text-xs text-slate-500">{currentCommunity} · {remaining ? `还差${remaining}份成团` : '已成团'}</View><View className="text-xl font-bold text-rose-600">¥{group.pricePerSlot}/份</View>
        <Button className="bg-[#07C160] text-white py-3 rounded-xl text-sm" openType="share" data-group-id={group.id}>分享给微信好友 / 群聊</Button>
        <Button className="bg-amber-50 text-amber-800 py-3 rounded-xl text-xs" disabled={!remaining} onClick={() => { onJoin(group); onClose(); }}>我要参与拼单</Button>
      </View>
    </View>
  </View>;
}
