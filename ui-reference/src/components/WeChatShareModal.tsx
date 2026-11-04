/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SplitGroup, Product } from '../types';
import { ProductArtwork } from './ProductArtwork';
import { formatRMB } from '../utils/orderCalculations';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  MessageCircle,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface WeChatShareModalProps {
  group: SplitGroup | null;
  product?: Product;
  currentCommunity: string;
  onClose: () => void;
  onJoin: (group: SplitGroup) => void;
}

export const WeChatShareModal: React.FC<WeChatShareModalProps> = ({
  group,
  product,
  currentCommunity,
  onClose,
  onJoin,
}) => {
  const [copied, setCopied] = useState(false);
  const [simulatedSent, setSimulatedSent] = useState(false);

  if (!group) return null;

  const remaining = Math.max(1, group.totalSlots - group.joinedCount);
  const iconType = product?.iconType || 'bakery';

  const handleCopyLink = () => {
    const shareText = `【山姆邻里拼单】我发起了「${group.productName}」拼单，仅差 ${remaining} 人锁单！单人仅需 ${formatRMB(group.pricePerSlot)}，万科自提点今日14:00封单发车，快来戳微信小程序卡片一起拼！#小程序://山姆邻里拼/${group.id}`;
    navigator.clipboard?.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulateSend = () => {
    setSimulatedSent(true);
    setTimeout(() => setSimulatedSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Top Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-xs">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">微信卡片分享预览</h3>
              <p className="text-[10px] text-slate-500">模拟微信群聊 / 好友对话中的卡片样式</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WeChat Chat Window Mock Stream */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Chat Bubble Context Container */}
          <div className="bg-[#EDEDED] rounded-2xl p-3 border border-slate-300/70 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-sm shadow-xs border border-white">
                👩
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-700">万科锦绣之城 业主群 (342人)</span>
                  <span className="text-[9px] bg-slate-300 text-slate-600 px-1 rounded">邻里拼单</span>
                </div>
                <p className="text-[10px] text-slate-400">刚刚</p>
              </div>
            </div>

            {/* The Authentic WeChat Mini Program Share Card */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200/80 transition-transform active:scale-[0.99]">
              {/* Mini Program Header Banner */}
              <div className="bg-slate-50 px-3 py-1.5 flex items-center justify-between border-b border-slate-100 text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#0055A5] flex items-center justify-center text-[7px] font-bold text-white">
                    S
                  </div>
                  <span>山姆邻里拼 · 微信小程序</span>
                </div>
                <span className="text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[9px]">
                  小程序
                </span>
              </div>

              {/* Card Headline */}
              <div className="px-3 pt-2.5 pb-1">
                <div className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md mb-1">
                  <Sparkles className="w-3 h-3 text-rose-500" />
                  <span>【紧急拼单】仅差 {remaining} 人封单发车！</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                  {group.productName}
                </h4>
              </div>

              {/* Product Artwork Preview */}
              <div className="relative mx-3 my-1 rounded-lg overflow-hidden border border-slate-100 shadow-inner">
                <ProductArtwork
                  type={iconType}
                  name={group.productName}
                  aspectRatio="16:9"
                  className="w-full h-32"
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/60 backdrop-blur-xs text-white px-2 py-1 rounded-md text-[10px]">
                  <span className="truncate">{group.slotDescription}</span>
                  <span className="font-bold text-amber-300 shrink-0">
                    {formatRMB(group.pricePerSlot)}/份
                  </span>
                </div>
              </div>

              {/* Card Footer with Details & Action Prompt */}
              <div className="p-3 bg-gradient-to-b from-white to-amber-50/50">
                <div className="flex items-center justify-between text-[11px] mb-2.5">
                  <div className="flex items-center gap-1 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      已参拼 <strong className="text-slate-900">{group.joinedCount}</strong> / {group.totalSlots} 人
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-700 font-mono text-[10px] bg-amber-100 px-1.5 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    <span>成团即可买</span>
                  </div>
                </div>

                {/* Simulated Call to Action Inside Card */}
                <button
                  onClick={() => {
                    onJoin(group);
                    onClose();
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <span>👉 点击立即加入拼单</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <p className="text-center text-[10px] text-slate-400 mt-2">
                  提货地点：{currentCommunity} 自提柜/物业点
                </p>
              </div>
            </div>
          </div>

          {/* Feedback Banner if sent */}
          {simulatedSent && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>已模拟发送至当前社区微信群！邻居点击卡片即可直接参拼。</span>
            </div>
          )}
        </div>

        {/* Share Action Controls */}
        <div className="bg-white p-3 border-t border-slate-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSimulateSend}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>发至微信群</span>
            </button>

            <button
              onClick={handleCopyLink}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                copied
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-600" />
                  <span>口令已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>复制拼单口令</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 pt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>支持微信内置 JSSDK wx.updateAppMessageShareData 分享</span>
          </div>
        </div>
      </div>
    </div>
  );
};
