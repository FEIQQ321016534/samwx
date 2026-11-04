// components/wechat-pay/wechat-pay.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    amount: {
      type: String,
      value: '0.00',
    },
    orderNumber: {
      type: String,
      value: '',
    },
  },

  data: {
    pin: '',
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'],
  },

  methods: {
    onKeyPress(e) {
      const val = e.currentTarget.dataset.val;
      if (!val) return;

      let currentPin = this.data.pin;
      if (val === '⌫') {
        currentPin = currentPin.slice(0, -1);
        this.setData({ pin: currentPin });
        return;
      }

      if (currentPin.length < 6) {
        currentPin += val;
        this.setData({ pin: currentPin });

        if (currentPin.length === 6) {
          wx.showLoading({ title: '安全验证中...' });
          setTimeout(() => {
            wx.hideLoading();
            this.setData({ pin: '' });
            this.triggerEvent('success', { orderNumber: this.data.orderNumber });
          }, 1000);
        }
      }
    },

    onCancel() {
      this.setData({ pin: '' });
      this.triggerEvent('cancel');
    },

    // 生产环境中直接调起真实微信支付的封装方法
    requestRealWeChatPay(payParams) {
      return new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType || 'RSA',
          paySign: payParams.paySign,
          success: (res) => resolve(res),
          fail: (err) => reject(err),
        });
      });
    },
  },
});
