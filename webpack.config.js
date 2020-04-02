module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [],
};
