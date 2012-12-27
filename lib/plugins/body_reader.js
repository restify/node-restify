// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var zlib = require('zlib');

var assert = require('assert-plus');

var errors = require('../errors');



///--- Globals

var BadDigestError = errors.BadDigestError;
var InvalidContentError = errors.InvalidContentError;
var RequestEntityTooLargeError = errors.RequestEntityTooLargeError;

var MD5_MSG = 'Content-MD5 \'%s\' didn\'t match \'%s\'';



///--- API

function bodyReader(options) {
        options = options || {};
        assert.object(options, 'options');

        var maxBodySize = options.maxBodySize || 0;

        function readBody(req, res, next) {
                if ((req.getContentLength() === 0 && !req.isChunked()) ||
                    req.contentType() === 'multipart/form-data') {
                        next();
                        return;
                }
                req.body = '';

                function done() {
                        if (maxBodySize && bytesReceived > maxBodySize) {
                                var msg = 'Request body size exceeds ' +
                                        maxBodySize;
                                next(new RequestEntityTooLargeError(msg));
                                return;
                        }

                        if (!req.body) {
                                next();
                                return;
                        }

                        if (hash && md5 !== (digest = hash.digest('base64'))) {
                                next(new BadDigestError(MD5_MSG, md5, digest));
                                return;
                        }

                        next();
                }

                var bytesReceived = 0;
                var digest;
                var gz;
                var hash;
                var md5;
                if ((md5 = req.headers['content-md5']))
                        hash = crypto.createHash('md5');

                if (req.headers['content-encoding'] === 'gzip') {
                        gz = zlib.createGunzip();
                        gz.on('data', function onData(chunk) {
                                req.body += chunk.toString('utf8');
                        });
                        gz.once('end', done);
                        req.once('end', gz.end.bind(gz));
                } else {
                        req.once('end', done);
                }

                req.on('data', function onRequestData(chunk) {
                        if (maxBodySize) {
                                bytesReceived += chunk.length;
                                if (bytesReceived > maxBodySize)
                                        return;
                        }

                        if (hash)
                                hash.update(chunk, 'binary');

                        if (gz) {
                                gz.write(chunk);
                        } else {
                                req.body += chunk.toString('utf8');
                        }
                });

                req.once('error', next);
                req.resume();
        }

        return (readBody);
}

module.exports = bodyReader;
