// components/product-card/product-card.js
Component({
  properties: {
    product: {
      type: Object,
      value: {},
    },
  },

  methods: {
    onOpenDetail() {
      this.triggerEvent('opendetail', { product: this.data.product });
    },

    onQuickSplit() {
      this.triggerEvent('quicksplit', { product: this.data.product });
    },

    onDirectBuy() {
      this.triggerEvent('directbuy', { product: this.data.product });
    },
  },
});
