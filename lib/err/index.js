// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var httpErrors = require('./http_error');
var RestError = require('./rest_error');


module.exports = {};
module.exports.RestError = RestError;
Object.keys(httpErrors).forEach(function(k) {
  module.exports[k] = httpErrors[k];
});
