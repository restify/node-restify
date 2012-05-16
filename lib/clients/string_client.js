// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var qs = require('querystring');
var util = require('util');

var HttpClient = require('./http_client');



///--- Helpers


///--- API

function StringClient(options) {
        options.accept = options.accept || 'text/plain';
        options.name = options.name || 'StringClient';
        options.contentType =
                options.contentType || 'application/x-www-form-urlencoded';

        HttpClient.call(this, options);
}
util.inherits(StringClient, HttpClient);
module.exports = StringClient;


StringClient.prototype.post = function post(options, body, callback) {
        var opts = this._options('POST', options);
        if (typeof (body) === 'function') {
                callback = body;
                body = null;
        }

        return (this.write(opts, body, callback));
};


StringClient.prototype.put = function put(options, body, callback) {
        var opts = this._options('PUT', options);
        if (typeof (body) === 'function') {
                callback = body;
                body = null;
        }

        return (this.write(opts, body, callback));
};


StringClient.prototype.read = function read(options, callback) {
        var self = this;
        this.request(options, function _parse(err, req) {
                if (err)
                        return (callback(err, req));

                req.once('result', self.parse(req, callback));
                return (req.end());
        });
        return (this);
};


StringClient.prototype.write = function write(options, body, callback) {
        if (body !== null && typeof (body) !== 'string')
                body = qs.stringify(body);

        var self = this;
        options.headers = options.headers || {};
        options.headers['content-length'] = Buffer.byteLength(body);

        var hash = crypto.createHash('md5');
        hash.update(body);
        options.headers['content-md5'] = hash.digest('base64');

        this.request(options, function _write(err, req) {
                if (err)
                        return (callback(err, req));

                if (body) {
                        self.log.trace('sending body -> %s', body);
                        req.write(body);
                }

                req.once('result', self.parse(req, callback));
                return (req.end());
        });
        return (this);
};


StringClient.prototype.parse = function parse(req, callback) {
        function parseResponse(err, res) {
                if (res) {
                        if (res.headers['transfer-encoding'] !== 'chunked' &&
                            !res.headers['content-length']) {
                                return (callback(err, req, res));
                        }

                        var body = '';
                        var hash;
                        var md5 = res.headers['content-md5'];
                        if (md5 && req.method !== 'HEAD')
                                hash = crypto.createHash('md5');

                        res.setEncoding('utf8');
                        res.on('data', function (chunk) {
                                body += chunk;
                                if (hash)
                                        hash.update(chunk);
                        });

                        return res.once('end', function () {
                                res.log.trace('body received:\n%s', body);

                                res.body = body;
                                if (hash && md5 !== hash.digest('base64'))
                                        return (callback(new Error('BadDigest'),
                                                         req,
                                                         res));

                                if (err) {
                                        err.body = body;
                                        err.message = body;
                                }

                                return (callback(err, req, res, body));
                        });
                } else {
                        return (callback(err, req, null, null));
                }
        }

        return (parseResponse);
};
