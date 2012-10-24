// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var util = require('util');

var assert = require('assert-plus');

var codeToHttpError = require('../errors/http_error').codeToHttpError;
var RestError = require('../errors').RestError;
var StringClient = require('./string_client');



///--- API

function JsonClient(options) {
        assert.object(options, 'options');

        options.accept = 'application/json';
        options.name = options.name || 'JsonClient';
        options.contentType = 'application/json';

        StringClient.call(this, options);

        this._super = StringClient.prototype;
}
util.inherits(JsonClient, StringClient);
module.exports = JsonClient;


JsonClient.prototype.write = function write(options, body, callback) {
        assert.ok(body, 'body');
        assert.object(body, 'body');
        body = JSON.stringify(body);
        return (this._super.write.call(this, options, body, callback));
};


JsonClient.prototype.parse = function parse(req, callback) {
        var _parse = this._super.parse;
        return (_parse.call(this, req, function (err, req2, res, data) {
                var obj;
                try {
                        if (data && !/^\s*$/.test(data)) {
                                obj = JSON.parse(data);
                        } else {
                                obj = {};
                        }
                } catch (e) {
                        return (callback(e, req2, res, null));
                }

                if (res && res.statusCode >= 400) {
                        // Upcast error to a RestError (if we can)
                        // Be nice and handle errors like
                        // { error: { code: '', message: '' } }
                        // in addition to { code: '', message: '' }.
                        if (obj.code || (obj.error && obj.error.code)) {
                                err = new RestError({
                                        message: (obj.message ||
                                                  obj.error.message),
                                        restCode: obj.code || obj.error.code,
                                        statusCode: res.statusCode
                                });
                                err.name = err.restCode;
                                if (!/Error$/.test(err.name))
                                        err.name += 'Error';
                        } else if (!err) {
                                err = codeToHttpError(res.statusCode,
                                                      obj.message || '', data);
                        }
                }

                if (err)
                        err.body = obj;

                return (callback((err || null), req2, res, obj));
        }));
};
