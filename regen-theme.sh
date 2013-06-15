#!/bin/bash

./node_modules/less/bin/lessc ./less/my-theme.less ./compiled-style.css

mkdir fonts
cp ./less/bootstrap/fonts/* fonts/

cat less/bootstrap/js/*.js > js/bootstrap.js

./node_modules/uglify-js/bin/uglifyjs -nc -v js/bootstrap.js > js/bootstrap.min.js

