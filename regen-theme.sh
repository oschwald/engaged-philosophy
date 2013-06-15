#!/bin/bash

./node_modules/less/bin/lessc ./less/my-theme.less ./compiled-style.css
cp ./less/bootstrap/assets/img/* img/

cat less/bootstrap/assets/js/*.js > js/bootstrap.js

./node_modules/uglify-js/bin/uglifyjs -nc -v js/bootstrap.js > js/bootstrap.min.js

