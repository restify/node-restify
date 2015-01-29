// Copyright 2012 Mark Cavage, Inc.  All rights reserved.
var http = require('http');
require('../lib/request');

var Request = http.IncomingMessage;

module.exports = {
    'request is upload': function (test) {
        var methods = {'PATCH' : true, 'POST' : true, 'PUT': true, 'GET': false, 'HEAD' : false, 'DELETE' : false, 'TRACE':  false}
        Object.keys(methods).forEach(function (m) {
            test.equal(Request.prototype.isUpload.apply({
                method: m
            }), methods[m], 'upload status for ' + m + ' is not valid');
        });
        test.done();
    }
};
