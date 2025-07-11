const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const { PurgeCSSPlugin } = require('purgecss-webpack-plugin');
const glob = require('glob-all');
const path = require('path');

module.exports = {
  ...defaultConfig,
  entry: {
    'style': './src/scss/style.scss',
    'theme-scripts': './src/js/index.js'
  },
  plugins: [
    ...defaultConfig.plugins,
    ...(process.env.NODE_ENV === 'production' ? [
      new PurgeCSSPlugin({
        paths: glob.sync([
          './**/*.php',
          './src/**/*.js',
          './src/**/*.scss',
          './inc/**/*.php',
          './partials/**/*.php'
        ], { 
          cwd: __dirname,
          ignore: ['node_modules/**/*']
        }),
        safelist: {
          standard: [
            // WordPress core classes
            'wp-admin-bar-*', 'wp-core-ui', 'screen-reader-text', 'visually-hidden',
            'alignleft', 'alignright', 'aligncenter', 'alignwide', 'alignfull',
            'wp-block', 'wp-element', 'wp-embed', 'wp-caption',
            // Bootstrap essentials that might be dynamic
            'show', 'fade', 'collapse', 'collapsing', 'active', 'disabled',
            // Custom theme classes
            'lead-home', 'carousel-caption', 'tag-cloud-projects', 'footer-custom'
          ],
          deep: [
            // WordPress dynamic classes
            /^wp-/, /^post-/, /^page-/, /^attachment-/, /^comment-/, /^category-/,
            // Bootstrap utility classes (commonly used dynamically)
            /^btn-/, /^text-/, /^bg-/, /^border-/, /^d-/, /^flex-/,
            /^justify-/, /^align-/, /^p-/, /^m-/, /^fs-/, /^fw-/, /^col-/,
            /^navbar-/, /^dropdown-/, /^modal-/, /^carousel-/, /^card-/,
            // Custom theme patterns
            /^widget/, /^entry-/, /^nav-/, /^menu-/
          ],
          greedy: [
            /^is-/, /^has-/, /^js-/
          ]
        },
        // Don't remove CSS from these selectors
        blocklist: []
      })
    ] : [])
  ]
};