export interface WindowGeometry {
  screenTop?: number;
  screenHeight?: number;
  windowHeight?: number;
  windowWidth?: number;
  statusBarHeight?: number;
  safeArea?: { top?: number; bottom?: number; left?: number; right?: number };
}
export interface CapsuleGeometry { top?: number; bottom?: number; height?: number; left?: number; width?: number }
const positive = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
const dimension = (value: unknown, fallback: number) => positive(value) || fallback;

// WeChat reports the capsule/safeArea in screen coordinates; CSS fixed layers
// use window coordinates. Values are logical pixels, never physical pixels/rpx.
export function computeWindowInsets(window: WindowGeometry = {}, capsule?: CapsuleGeometry) {
  const screenTop = positive(window.screenTop);
  const height = dimension(window.windowHeight, dimension(window.screenHeight, 667));
  const width = dimension(window.windowWidth, 375);
  const status = Math.max(positive(window.statusBarHeight), positive(window.safeArea?.top));
  const menuTop = positive(capsule?.top, -1);
  const menuBottom = positive(capsule?.bottom, -1);
  const validMenu = menuTop >= status && menuBottom > menuTop && menuBottom - menuTop <= 64 && menuBottom <= screenTop + height;
  const obstruction = validMenu ? Math.max(status, menuBottom) : status + 48;
  const top = Math.min(height, Math.max(0, Math.ceil(obstruction - screenTop)) + (obstruction > screenTop ? 8 : 0));
  const reportedBottom = positive(window.safeArea?.bottom);
  const safeBottom = reportedBottom > status ? reportedBottom : screenTop + height;
  const bottom = Math.min(height - top, Math.max(0, Math.ceil(screenTop + height - safeBottom)));
  const menuLeft = positive(capsule?.left, width - 96);
  return {
    top, bottom, height,
    contentHeight: Math.max(0, height - top - bottom),
    status: Math.max(0, status - screenTop),
    capsuleRight: validMenu ? Math.max(96, width - menuLeft + 12) : 100,
  };
}
