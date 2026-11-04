# 山姆邻里拼 · 微信小程序代码模版使用指南

本目录包含已将 React 核心组件转换为 **Taro (React + TS)** 与 **微信小程序原生 (WXML + WXSS + JS)** 的模版代码。

## 目录结构

```
miniprogram-templates/
├── taro/                         # 方案一：Taro v3+ 模版 (推荐，90%+ 直接复用)
│   ├── ProductCard.taro.tsx      # 山姆商品卡片组件
│   ├── SplitGroupCard.taro.tsx   # 拼单进度条与倒计时组件
│   └── WeChatPayModal.taro.tsx   # 微信支付弹窗与 wx.requestPayment 调用
└── native/                       # 方案二：微信小程序原生模版
    ├── product-card.wxml / wxss / js
    ├── split-group.wxml / wxss / js
    └── wechat-pay.wxml / wxss / js
```

---

## 方案一：使用 Taro 工程（极力推荐）

Taro 是最接近当前项目代码的方案。通过 `weapp-tailwindcss` 插件，可以直接继续在 Taro 中使用 Tailwind CSS。

### 1. 创建 Taro 项目
```bash
npx @tarojs/cli init sam-neighborhood-miniapp
# 选择：React + TypeScript + Tailwind CSS
```

### 2. 安装 weapp-tailwindcss
```bash
npm install weapp-tailwindcss -D
```

### 3. 复用核心逻辑与数据
- 将本项目中的 `src/utils/orderCalculations.ts` 直接拷贝到 Taro 项目的 `src/utils/orderCalculations.ts`，**零改动即可直接运行**！
- 将本项目中的 `src/types/index.ts` 直接拷贝到 Taro 项目中使用。

---

## 方案二：微信小程序原生工程

如果你正在使用微信官方开发者工具维护原生小程序：

### 1. 引入组件
在小程序的页面配置 `index.json` 中注册自定义组件：
```json
{
  "usingComponents": {
    "product-card": "/components/product-card/product-card",
    "split-group": "/components/split-group/split-group",
    "wechat-pay": "/components/wechat-pay/wechat-pay"
  }
}
```

### 2. 页面中引用 WXML
```xml
<!-- 拼单列表 -->
<split-group 
  wx:for="{{groupList}}" 
  wx:key="id" 
  group="{{item}}" 
  bind:share="handleShare" 
  bind:join="handleJoin" 
/>
```

### 3. 生产环境微信支付闭环 (后端 API 签名)
在 `wechat-pay.js` 中已预留封装好的 `requestRealWeChatPay` 方法：
```javascript
// 当后端创建预支付单返回参数后：
this.selectComponent('#wechat-pay').requestRealWeChatPay({
  timeStamp: res.data.timeStamp,
  nonceStr: res.data.nonceStr,
  package: res.data.package,
  signType: 'RSA',
  paySign: res.data.paySign
}).then(() => {
  wx.showToast({ title: '支付成功' });
});
```
