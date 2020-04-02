// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      zIndex: {
        '-1': '-1',
      },
    },
  },
  variants: {},
  plugins: [require('@tailwindcss/ui')],
};
