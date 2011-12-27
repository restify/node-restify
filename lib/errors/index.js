// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var httpErrors = require('./http_error');
var restErrors = require('./rest_error');


module.exports = {};

Object.keys(httpErrors).forEach(function(k) {
  module.exports[k] = httpErrors[k];
});

Object.keys(restErrors).forEach(function(k) {
  module.exports[k] = restErrors[k];
});
