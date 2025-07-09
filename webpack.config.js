const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
  ...defaultConfig,
  entry: {
    'style': './src/scss/style.scss',
    'theme-scripts': './src/js/index.js'
  }
};