/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Taro 跨端组件：微信支付模态弹窗 (WeChatPayModal.taro.tsx)
 * 包含：原生 wx.requestPayment 真实支付调用与模拟支付演示
 */

import React, { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';

interface WeChatPayModalProps {
  isOpen: boolean;
  amount: number;
  orderNumber?: string;
  payParams?: {
    timeStamp: string;
    nonceStr: string;
    packageVal: string;
    signType: 'RSA' | 'MD5';
    paySign: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export const WeChatPayModal: React.FC<WeChatPayModalProps> = ({
  isOpen,
  amount,
  orderNumber = 'SAM-20261103-01',
  payParams,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  // 1. 如果有后端返回的微信支付真实参数，直接调起原生微信支付
  const handleRealWeChatPay = async () => {
    if (!payParams) return;
    try {
      setIsProcessing(true);
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
      Taro.showToast({ title: '支付已取消', icon: 'none' });
      onCancel();
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. 模拟键盘输入（用于原型体验与无商户号测试）
  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 6) {
        setIsProcessing(true);
        setTimeout(() => {
          setIsProcessing(false);
          setPin('');
          onSuccess();
        }, 1200);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <View className="bg-white rounded-3xl w-11/12 max-w-sm overflow-hidden flex flex-col">
        {/* 顶部标题栏 */}
        <View className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <Text className="text-sm font-bold text-slate-800">微信支付</Text>
          <Button onClick={onCancel} className="text-xs text-slate-400 bg-transparent">✕</Button>
        </View>

        {/* 金额展示 */}
        <View className="p-6 flex flex-col items-center">
          <Text className="text-xs text-slate-500">山姆邻里拼 · 专职代购</Text>
          <Text className="text-3xl font-bold text-slate-900 mt-2">¥{amount.toFixed(2)}</Text>
          <Text className="text-[10px] text-slate-400 mt-1 font-mono">订单号: {orderNumber}</Text>

          {/* 6位密码框 */}
          <View className="flex flex-row gap-2 mt-6">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <View
                key={idx}
                className="w-10 h-10 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50"
              >
                {pin.length > idx && (
                  <View className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* 微信风格软键盘 */}
        <View className="bg-slate-100 p-2 grid grid-cols-3 gap-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((item, idx) => (
            <Button
              key={idx}
              onClick={() => {
                if (item === '⌫') handleDelete();
                else if (item) handleDigit(item);
              }}
              className="py-3 bg-white active:bg-slate-200 rounded-lg font-bold text-base text-center"
            >
              {item}
            </Button>
          ))}
        </View>
      </View>
    </View>
  );
};
export default WeChatPayModal;
