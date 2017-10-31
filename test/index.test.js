// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';
/* eslint-disable func-names */

var httpDate = require('../lib/http_date');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;

///--- Tests

test('httpDate', function(t) {
    var d = httpDate();
    var regex = /\w{3}, \d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT/;
    t.ok(regex.test(d));
    t.end();
});
