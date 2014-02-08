// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var zlib = require('zlib');

var assert = require('assert-plus');
var qs = require('querystring');
var util = require('util');

var HttpClient = require('./http_client');


///--- Helpers


///--- API

function StringClient(options) {
    assert.object(options, 'options');
    assert.optionalObject(options.gzip, 'options.gzip');

    options.accept = options.accept || 'text/plain';
    options.name = options.name || 'StringClient';
    options.contentType =
        options.contentType || 'application/x-www-form-urlencoded';

    HttpClient.call(this, options);
    this.gzip = options.gzip;
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


StringClient.prototype.patch = function patch(options, body, callback) {
    var opts = this._options('PATCH', options);
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

    function _write(data) {
        if (data) {
            var hash = crypto.createHash('md5');
            hash.update(data, 'utf8');
            options.headers['content-md5'] = hash.digest('base64');
        }

        self.request(options, function (err, req) {
            if (err) {
                callback(err, req);
                return;
            }

            req.once('result', self.parse(req, callback));
            req.end(data);
        });
    }

    options.headers = options.headers || {};

    if (this.gzip)
        options.headers['accept-encoding'] = 'gzip';

    if (body) {
        if (this.gzip) {
            options.headers['content-encoding'] = 'gzip';
            zlib.gzip(body, function (err, data) {
                if (err) {
                    callback(err, null);
                    return;
                }

                options.headers['content-length'] = data.length;
                _write(data);
            });
        } else {
            options.headers['content-length'] =
                Buffer.byteLength(body);
            _write(body);
        }
    } else {
        _write();
    }

    return (this);
};


StringClient.prototype.parse = function parse(req, callback) {
    function parseResponse(err, res) {
        if (res) {
            function done() {
                res.log.trace('body received:\n%s', body);
                res.body = body;
                if (hash && md5 !== hash.digest('base64')) {
                    err = new Error('BadDigest');
                    callback(err, req, res);
                    return;
                }

                if (err) {
                    err.body = body;
                    err.message = body;
                }

                callback(err, req, res, body);
            }

            var body = '';
            var gz;
            var hash;
            var md5 = res.headers['content-md5'];
            if (md5 && req.method !== 'HEAD')
                hash = crypto.createHash('md5');

            if (res.headers['content-encoding'] === 'gzip') {
                gz = zlib.createGunzip();
                gz.on('data', function (chunk) {
                    body += chunk.toString('utf8');
                });
                gz.once('end', done);
                res.once('end', gz.end.bind(gz));
            } else {
                res.setEncoding('utf8');
                res.once('end', done);
            }

            res.on('data', function onData(chunk) {
                if (hash)
                    hash.update(chunk);

                if (gz) {
                    gz.write(chunk);
                } else {
                    body += chunk;
                }
            });

        } else {
            callback(err, req, null, null);
        }
    }

    return (parseResponse);
};
