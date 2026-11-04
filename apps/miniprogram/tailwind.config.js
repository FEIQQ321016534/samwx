module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      borderRadius: { xs: '0.125rem' },
      boxShadow: { xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
      backdropBlur: { xs: '2px' },
    },
  },
};
