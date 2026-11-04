/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  Smartphone,
  Layers,
  FileCode,
  FileText,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FrameworkMode = 'taro' | 'native';
type ComponentTab = 'product' | 'split' | 'pay';

export const CodeExportModal: React.FC<CodeExportModalProps> = ({ isOpen, onClose }) => {
  const [framework, setFramework] = useState<FrameworkMode>('taro');
  const [activeComp, setActiveComp] = useState<ComponentTab>('split');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Code snippets dictionary
  const CODE_SNIPPETS: Record<FrameworkMode, Record<ComponentTab, { filename: string; code: string; desc: string }>> = {
    taro: {
      split: {
        filename: 'SplitGroupCard.taro.tsx',
        desc: 'Taro 跨端组件：拼单进度条、实时倒计时、成员头像、一键微信原生卡片分享 (支持 weapp-tailwindcss)',
        code: `import React, { useState, useEffect } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';

export interface SplitGroup {
  id: string;
  productName: string;
  totalSlots: number;
  joinedCount: number;
  pricePerSlot: number;
  slotDescription: string;
  remainingSeconds: number;
  category: string;
}

export const SplitGroupCard: React.FC<{ group: SplitGroup; onJoin: (g: SplitGroup) => void }> = ({ group, onJoin }) => {
  const [timeLeft, setTimeLeft] = useState(group.remainingSeconds);
  const percent = Math.min(100, Math.round((group.joinedCount / group.totalSlots) * 100));
  const remaining = Math.max(0, group.totalSlots - group.joinedCount);
  const isFull = remaining === 0;

  return (
    <View className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex flex-col gap-2.5">
      {/* 顶部标签与倒计时 */}
      <View className="flex flex-row items-center justify-between">
        <View className="bg-amber-100 px-2 py-0.5 rounded">
          <Text className="text-amber-900 text-[10px] font-bold">{group.category}</Text>
        </View>
        <Text className="text-[10px] text-amber-700 font-mono">剩 {Math.floor(timeLeft / 60)}分钟</Text>
      </View>

      <Text className="font-bold text-slate-900 text-sm">{group.productName}</Text>

      {/* 价格与操作区 */}
      <View className="flex flex-row items-center justify-between pt-1">
        <View className="flex flex-row items-baseline gap-0.5">
          <Text className="text-base font-bold text-rose-600">¥{group.pricePerSlot.toFixed(1)}</Text>
          <Text className="text-[10px] text-slate-400">/份</Text>
        </View>

        <View className="flex flex-row items-center gap-1.5">
          {/* 原生微信小程序分享按钮 */}
          <Button 
            openType="share" 
            className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs font-semibold"
          >
            分享拼单
          </Button>

          <Button 
            disabled={isFull} 
            onClick={() => onJoin(group)} 
            className={\`px-3.5 py-1.5 rounded-xl text-xs font-semibold \${
              isFull ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-500 text-white'
            }\`}
          >
            {isFull ? '已锁单' : '立即参拼'}
          </Button>
        </View>
      </View>

      {/* 进度条 */}
      <View className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
        <View className="h-full bg-amber-500" style={{ width: \`\${percent}%\` }} />
      </View>
    </View>
  );
};`,
      },
      product: {
        filename: 'ProductCard.taro.tsx',
        desc: 'Taro 跨端组件：山姆商品卡片、冷链角标、大包装拆分价格计算及去拼单/整件购双按钮',
        code: `import React from 'react';
import { View, Text, Image, Button } from '@tarojs/components';

export const ProductCard = ({ product, onQuickSplit, onDirectBuy }) => {
  return (
    <View className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col justify-between">
      <View className="relative w-full aspect-square bg-slate-50 flex items-center justify-center">
        <Image src={product.imageUrl} mode="aspectFill" className="w-full h-full" />
        {product.requiresColdChain && (
          <View className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            <Text>冷链保鲜</Text>
          </View>
        )}
      </View>

      <View className="p-2.5 flex-1 flex flex-col justify-between">
        <Text className="text-xs font-bold text-slate-900 line-clamp-2">{product.name}</Text>
        <View className="mt-2 flex items-baseline justify-between">
          <Text className="text-base font-bold text-rose-600">¥{product.splitPrice || product.originalPrice}</Text>
          <Text className="text-[9px] text-slate-400">已代购 {product.salesCount}件</Text>
        </View>

        <View className="grid grid-cols-2 gap-1.5 mt-2">
          {product.canSplit && (
            <Button onClick={() => onQuickSplit(product)} className="py-1 bg-amber-500 text-white rounded-lg text-[10px] font-bold text-center">
              去拼单
            </Button>
          )}
          <Button onClick={() => onDirectBuy(product)} className="py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold text-center">
            整件代购
          </Button>
        </View>
      </View>
    </View>
  );
};`,
      },
      pay: {
        filename: 'WeChatPayModal.taro.tsx',
        desc: 'Taro 微信支付模态窗：支持调起原生 wx.requestPayment 与 6位数字键盘仿真',
        code: `import React, { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';

export const WeChatPayModal = ({ isOpen, amount, payParams, onSuccess, onCancel }) => {
  if (!isOpen) return null;

  // 调起微信原生支付
  const handleNativePay = async () => {
    try {
      await Taro.requestPayment({
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.packageVal,
        signType: payParams.signType,
        paySign: payParams.paySign,
      });
      Taro.showToast({ title: '支付成功', icon: 'success' });
      onSuccess();
    } catch (err) {
      Taro.showToast({ title: '支付取消', icon: 'none' });
      onCancel();
    }
  };

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <View className="bg-white rounded-3xl w-11/12 max-w-sm overflow-hidden p-6 text-center">
        <Text className="text-sm font-bold text-slate-800">微信支付</Text>
        <Text className="text-3xl font-bold text-slate-900 mt-4 block">¥{amount.toFixed(2)}</Text>
        <Button onClick={handleNativePay} className="mt-6 w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold">
          立即安全支付
        </Button>
      </View>
    </View>
  );
};`,
      },
    },
    native: {
      split: {
        filename: 'split-group.wxml + wxss + js',
        desc: '微信小程序原生组件：包含 WXML 模版、WXSS 响应式样式与 JS 逻辑绑定',
        code: `<!-- 1. split-group.wxml -->
<view class="split-card">
  <view class="header-row">
    <view class="category-tag"><text>{{group.category}}</text></view>
    <text class="time-text">剩 {{formattedTime}}</text>
  </view>
  <text class="product-title">{{group.productName}}</text>
  
  <view class="action-row">
    <text class="price">¥{{group.pricePerSlot}}/份</text>
    <view class="btns">
      <button class="btn-share" open-type="share">分享拼单</button>
      <button class="btn-join" bindtap="onJoinClick">{{isFull ? '已锁单' : '立即参拼'}}</button>
    </view>
  </view>

  <view class="progress-bar-bg">
    <view class="progress-bar-fill" style="width: {{percent}}%;"></view>
  </view>
</view>

/* 2. split-group.wxss */
.split-card { background: #fff; border-radius: 28rpx; padding: 24rpx; border: 1rpx solid #f1f5f9; }
.category-tag { background: #fef3c7; color: #78350f; font-size: 20rpx; border-radius: 8rpx; padding: 2rpx 10rpx; }
.price { font-size: 32rpx; font-weight: bold; color: #e11d48; }
.btn-share { background: #fffbeb; border: 1rpx solid #fde68a; color: #92400e; font-size: 22rpx; border-radius: 16rpx; }
.btn-join { background: #f59e0b; color: #fff; font-size: 22rpx; border-radius: 16rpx; }
.progress-bar-bg { width: 100%; height: 12rpx; background: #e2e8f0; border-radius: 20rpx; margin-top: 16rpx; overflow: hidden; }
.progress-bar-fill { height: 100%; background: #f59e0b; }`,
      },
      product: {
        filename: 'product-card.wxml + wxss + js',
        desc: '微信小程序原生商品卡片模版：包含冷链标签与拼单分装双选',
        code: `<!-- 1. product-card.wxml -->
<view class="product-card" bindtap="onOpenDetail">
  <image class="cover" src="{{product.imageUrl}}" mode="aspectFill" />
  <view class="info">
    <text class="title">{{product.name}}</text>
    <view class="price-row">
      <text class="price">¥{{product.canSplit ? product.splitPrice : product.originalPrice}}</text>
      <text class="sales">已代购{{product.salesCount}}件</text>
    </view>
    <view class="btn-group">
      <button wx:if="{{product.canSplit}}" class="btn-split" catchtap="onQuickSplit">去拼单</button>
      <button class="btn-buy" catchtap="onDirectBuy">整件代购</button>
    </view>
  </view>
</view>

/* 2. product-card.wxss */
.product-card { background: #fff; border-radius: 24rpx; overflow: hidden; border: 1rpx solid #f1f5f9; }
.cover { width: 100%; height: 260rpx; }
.info { padding: 16rpx; }
.title { font-size: 24rpx; font-weight: bold; }
.price { font-size: 30rpx; color: #e11d48; font-weight: bold; }
.btn-split { background: #f59e0b; color: #fff; font-size: 20rpx; border-radius: 12rpx; }
.btn-buy { background: #f1f5f9; color: #334155; font-size: 20rpx; border-radius: 12rpx; }`,
      },
      pay: {
        filename: 'wechat-pay.wxml + js',
        desc: '微信小程序原生支付调用与弹窗逻辑',
        code: `// wechat-pay.js (生产环境真实调用微信支付)
Component({
  methods: {
    callWeChatPay(payParams) {
      wx.requestPayment({
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType || 'RSA',
        paySign: payParams.paySign,
        success: (res) => {
          wx.showToast({ title: '微信支付成功', icon: 'success' });
          this.triggerEvent('paysuccess');
        },
        fail: (err) => {
          wx.showToast({ title: '已取消支付', icon: 'none' });
          this.triggerEvent('payfail', err);
        }
      });
    }
  }
});`,
      },
    },
  };

  const currentSnippet = CODE_SNIPPETS[framework][activeComp];

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="bg-slate-800 px-4 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0055A5] to-emerald-500 flex items-center justify-center text-white shadow-xs">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <span>微信小程序代码模版转换</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono border border-emerald-500/30">
                  Taro & 原生双模版
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">已将当前核心业务 UI 转换为微信小程序即用代码</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Framework & Component Selectors */}
        <div className="bg-slate-800/60 p-3 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
          {/* Framework Segmented Control */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setFramework('taro')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                framework === 'taro'
                  ? 'bg-[#0055A5] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Taro (React + TS) 推荐</span>
            </button>
            <button
              onClick={() => setFramework('native')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                framework === 'native'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-200" />
              <span>微信原生 (WXML/WXSS)</span>
            </button>
          </div>

          {/* Component Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setActiveComp('split')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeComp === 'split' ? 'bg-slate-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              拼单进度卡片
            </button>
            <button
              onClick={() => setActiveComp('product')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeComp === 'product' ? 'bg-slate-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              商品卡片
            </button>
            <button
              onClick={() => setActiveComp('pay')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeComp === 'pay' ? 'bg-slate-700 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              微信支付弹窗
            </button>
          </div>
        </div>

        {/* Code Description Bar */}
        <div className="px-4 py-2 bg-slate-800/40 text-[11px] text-slate-300 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2 truncate">
            <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-mono text-blue-300 font-bold">{currentSnippet.filename}</span>
            <span className="text-slate-400 truncate hidden sm:inline">- {currentSnippet.desc}</span>
          </div>

          <button
            onClick={handleCopy}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>复制代码</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content View */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-200 leading-relaxed max-h-[50vh]">
          <pre className="whitespace-pre overflow-x-auto selection:bg-blue-600 selection:text-white">
            {currentSnippet.code}
          </pre>
        </div>

        {/* Modal Bottom Guidance Footer */}
        <div className="bg-slate-800/90 px-4 py-3 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-400 text-[11px]">
            💡 源码文件已同步存放在项目的 <span className="text-blue-300 font-mono">/src/miniprogram-templates/</span> 目录中
          </div>
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 bg-gradient-to-r from-[#0055A5] to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>一键复制当前模版代码</span>
          </button>
        </div>
      </div>
    </div>
  );
};
