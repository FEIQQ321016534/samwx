// components/split-group/split-group.js
Component({
  properties: {
    group: {
      type: Object,
      value: {},
      observer(newVal) {
        if (newVal) {
          this.calculateState(newVal);
        }
      },
    },
  },

  data: {
    formattedTime: '',
    percent: 0,
    remaining: 0,
    isFull: false,
  },

  lifetimes: {
    attached() {
      this.calculateState(this.data.group);
    },
  },

  methods: {
    calculateState(group) {
      if (!group || !group.totalSlots) return;
      const remaining = Math.max(0, group.totalSlots - group.joinedCount);
      const percent = Math.min(100, Math.round((group.joinedCount / group.totalSlots) * 100));
      const s = group.remainingSeconds || 3600;
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const formattedTime = `${m < 10 ? '0' : ''}${m}分${sec < 10 ? '0' : ''}${sec}秒`;

      this.setData({
        remaining,
        percent,
        isFull: remaining === 0,
        formattedTime,
      });
    },

    onShareClick() {
      // 携带拼单商品信息触发分享
      this.triggerEvent('share', { group: this.data.group });
    },

    onJoinClick() {
      this.triggerEvent('join', { group: this.data.group });
    },
  },
});
