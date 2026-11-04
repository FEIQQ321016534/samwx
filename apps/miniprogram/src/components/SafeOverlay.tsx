import React, { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View } from './ui';
import { computeWindowInsets, type WindowGeometry } from '../utils/viewport';

function readInsets() {
  if (process.env.TARO_ENV !== 'weapp') return null;
  let window: WindowGeometry = {};
  let capsule;
  try { window = Taro.getWindowInfo() || {}; } catch {
    try { window = Taro.getSystemInfoSync() || {}; } catch { /* conservative fallback */ }
  }
  if (!window.windowHeight) {
    try { window = Taro.getSystemInfoSync() || window; } catch { /* use available dimensions */ }
  }
  try { capsule = Taro.getMenuButtonBoundingClientRect(); } catch { /* use navigation fallback */ }
  return computeWindowInsets(window, capsule);
}

export function useSafeWindowInsets() {
  const [insets, setInsets] = useState(readInsets);
  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp') return;
    const refresh = () => setInsets(readInsets());
    refresh();
    Taro.onWindowResize?.(refresh);
    Taro.onAppShow?.(refresh);
    return () => { Taro.offWindowResize?.(refresh); Taro.offAppShow?.(refresh); };
  }, []);
  const top = insets ? `${insets.top}px` : 'env(safe-area-inset-top, 0px)';
  const bottom = insets ? `${insets.bottom}px` : 'env(safe-area-inset-bottom, 0px)';
  return { insets, top, bottom, variables: {
    '--modal-safe-top': top,
    '--modal-safe-bottom': bottom,
    '--modal-max-height': insets ? `${insets.contentHeight}px` : `calc(100vh - ${top} - ${bottom})`,
  } as React.CSSProperties };
}

export function SafeOverlay({ children, className = '', style, ...props }: any) {
  const safe = useSafeWindowInsets();
  return <View {...props} className={`safe-modal-overlay ${className}`} style={{...style,...safe.variables,paddingTop:safe.top,paddingBottom:safe.bottom}}>{children}</View>;
}
