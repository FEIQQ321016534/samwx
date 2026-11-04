import { defineConfig } from '@tarojs/cli';
import { UnifiedWebpackPluginV5 } from 'weapp-tailwindcss/webpack';
const outputRoot = process.env.TARO_ENV === 'h5' ? 'dist-h5' : process.env.SAM_BUILD_TARGET === 'uat' ? 'dist-uat' : 'dist';

export default defineConfig({
  projectName: '山姆邻里拼',
  date: '2026-11-03',
  designWidth: 750,
  deviceRatio: { 375: 2, 640: 1.17, 750: 1, 828: 0.905 },
  sourceRoot: 'src',
  outputRoot,
  framework: 'react',
  compiler: { type: 'webpack5', prebundle: { enable: false } },
  plugins: [],
  defineConstants: { 'process.env.SAM_BUILD_TARGET': JSON.stringify(process.env.SAM_BUILD_TARGET || 'development'), 'process.env.TARO_APP_API_BASE_URL': JSON.stringify(process.env.TARO_APP_API_BASE_URL || '') },
  copy: { patterns: [{ from: 'src/assets', to: `${outputRoot}/assets` }], options: {} },
  h5: {
    publicPath: '/', staticDirectory: 'static',
    router: { mode: 'hash' },
    devServer: { host: '127.0.0.1', port: 3000 },
    postcss: { pxtransform: { enable: true, config: { designWidth: 750 } } },
  },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false },
    },
    webpackChain(chain) {
      chain.plugin('weapp-tailwindcss').use(UnifiedWebpackPluginV5, [{ rem2rpx: true }]);
    },
  },
});
