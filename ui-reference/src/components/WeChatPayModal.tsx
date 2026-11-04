/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { formatRMB } from '../utils/orderCalculations';
import { X, CheckCircle2, ShieldCheck, Lock, Fingerprint } from 'lucide-react';

interface WeChatPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onPaymentSuccess: () => void;
}

export const WeChatPayModal: React.FC<WeChatPayModalProps> = ({
  isOpen,
  onClose,
  amount,
  onPaymentSuccess,
}) => {
  if (!isOpen) return null;

  const [pin, setPin] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Play subtle WeChat pleasant payment chime
  const playPaymentSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // AudioContext fallback
    }
  };

  const handleKeyClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 6) {
        // Trigger simulated verification
        setIsProcessing(true);
        setTimeout(() => {
          setIsProcessing(false);
          setIsSuccess(true);
          playPaymentSound();
          setTimeout(() => {
            onPaymentSuccess();
          }, 1000);
        }, 800);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleQuickPay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      playPaymentSound();
      setTimeout(() => {
        onPaymentSuccess();
      }, 1000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* WeChat Top Bar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1"
            aria-label="取消支付"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
            <span className="w-4 h-4 rounded-full bg-[#07C160] flex items-center justify-center text-white text-[10px]">
              ✓
            </span>
            <span>微信支付</span>
          </div>
          <div className="w-5" />
        </div>

        {isSuccess ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">支付成功</h3>
            <p className="text-xs text-slate-500">
              已进入【第1103期】山姆线下代购清单
            </p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">
              {formatRMB(amount)}
            </p>
          </div>
        ) : (
          <div className="p-5 flex flex-col items-center space-y-4">
            {/* Payee Info */}
            <div>
              <p className="text-xs text-slate-500">向邻里代购团长付款</p>
              <h2 className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatRMB(amount)}
              </h2>
            </div>

            {/* Payment Method */}
            <div className="w-full bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600 flex items-center justify-between border border-slate-100">
              <span>付款方式</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <span>微信零钱 (剩余¥3,850.20)</span>
              </span>
            </div>

            {/* PIN Dots */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400">请输入支付密码</span>
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-9 h-10 rounded-lg border flex items-center justify-center text-lg ${
                      pin.length > i
                        ? 'border-[#07C160] bg-emerald-50 text-slate-900 font-bold'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {pin.length > i ? '●' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Biometric Quick Pay */}
            <button
              onClick={handleQuickPay}
              disabled={isProcessing}
              className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#07C160] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/60"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{isProcessing ? '正在验证指纹/面容...' : '使用微信面容 / 指纹快速支付'}</span>
            </button>

            {/* Keypad */}
            <div className="w-full grid grid-cols-3 gap-2 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeyClick(digit)}
                  className="py-3 bg-slate-100/90 active:bg-slate-200 text-slate-800 rounded-xl font-bold text-lg transition-colors"
                >
                  {digit}
                </button>
              ))}
              <div className="bg-transparent" />
              <button
                onClick={() => handleKeyClick('0')}
                className="py-3 bg-slate-100/90 active:bg-slate-200 text-slate-800 rounded-xl font-bold text-lg transition-colors"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="py-3 bg-slate-200/80 active:bg-slate-300 text-slate-600 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center"
              >
                删除
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
