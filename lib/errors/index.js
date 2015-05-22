// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var httpErrors = require('./http_error');
var restErrors = require('./rest_error');


module.exports = {};

Object.keys(httpErrors).forEach(function (k) {
    module.exports[k] = httpErrors[k];
});

// Note some of the RestErrors overwrite plain HTTP errors.
Object.keys(restErrors).forEach(function (k) {
    module.exports[k] = restErrors[k];
});
