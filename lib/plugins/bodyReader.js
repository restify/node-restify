// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var crypto = require('crypto');
var zlib = require('zlib');

var assert = require('assert-plus');
var once = require('once');
var errors = require('restify-errors');

///--- Globals

var BadDigestError = errors.BadDigestError;
var RequestEntityTooLargeError = errors.RequestEntityTooLargeError;
var PayloadTooLargeError = errors.PayloadTooLargeError;
var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;

var MD5_MSG = "Content-MD5 '%s' didn't match '%s'";

///--- Helpers

function createBodyWriter(req) {
    var buffers = [];

    var contentType = req.contentType();
    var isText = false;

    if (
        !contentType ||
        contentType === 'application/json' ||
        contentType === 'application/x-www-form-urlencoded' ||
        contentType === 'multipart/form-data' ||
        contentType.substr(0, 5) === 'text/'
    ) {
        isText = true;
    }

    req.body = new Buffer(0);
    return {
        write: function write(chunk) {
            buffers.push(chunk);
        },
        end: function end() {
            req.body = Buffer.concat(buffers);

            if (isText) {
                req.body = req.body.toString('utf8');
            }
        }
    };
}

///--- API

/**
 * Reads the body of the request.
 *
 * @public
 * @function bodyReader
 * @throws   {BadDigestError | PayloadTooLargeError}
 * @param    {Object} options - an options object
 * @returns  {Function} Handler
 */
function bodyReader(options) {
    var opts = options || {};
    assert.object(opts, 'opts');

    var maxBodySize = opts.maxBodySize || 0;

    function readBody(req, res, originalNext) {
        var next = once(originalNext);

        // #100 don't read the body again if we've read it once
        if (req._readBody) {
            next();
            return;
        } else {
            req._readBody = true;
        }

        if (
            (req.getContentLength() === 0 && !req.isChunked()) ||
            req.contentType() === 'multipart/form-data' ||
            req.contentType() === 'application/octet-stream'
        ) {
            next();
            return;
        }
        var bodyWriter = createBodyWriter(req);

        var bytesReceived = 0;
        var digest;
        var gz;
        var hash;
        var md5;

        var unsupportedContentEncoding;

        if ((md5 = req.headers['content-md5'])) {
            hash = crypto.createHash('md5');
        }

        function done() {
            bodyWriter.end();

            if (unsupportedContentEncoding) {
                next(
                    new UnsupportedMediaTypeError(
                        {
                            info: {
                                contentEncoding: unsupportedContentEncoding
                            }
                        },
                        'content encoding not supported'
                    )
                );
                return;
            }

            if (maxBodySize && bytesReceived > maxBodySize) {
                var msg = 'Request body size exceeds ' + maxBodySize;
                var err;

                // Between Node 0.12 and 4 http status code messages changed
                // RequestEntityTooLarge was changed to PayloadTooLarge
                // this check is to maintain backwards compatibility
                if (PayloadTooLargeError !== undefined) {
                    err = new PayloadTooLargeError(msg);
                } else {
                    err = new RequestEntityTooLargeError(msg);
                }

                next(err);
                return;
            }

            if (!req.body.length) {
                next();
                return;
            }

            if (hash && md5 !== (digest = hash.digest('base64'))) {
                next(new BadDigestError(MD5_MSG, md5, digest));
                return;
            }

            next();
        }

        if (req.headers['content-encoding'] === undefined) {
            // This handles the original else branch
            req.once('end', done);
        } else if (req.headers['content-encoding'] === 'gzip') {
            gz = zlib.createGunzip();
            gz.on('data', bodyWriter.write);
            gz.once('end', done);
            req.once('end', gz.end.bind(gz));
        } else {
            unsupportedContentEncoding = req.headers['content-encoding'];
            res.setHeader('Accept-Encoding', 'gzip');
            req.once('end', done);
        }

        req.on('data', function onRequestData(chunk) {
            if (maxBodySize) {
                bytesReceived += chunk.length;

                if (bytesReceived > maxBodySize) {
                    return;
                }
            }

            if (hash) {
                hash.update(chunk, 'binary');
            }

            if (gz) {
                gz.write(chunk);
            } else {
                bodyWriter.write(chunk);
            }
        });

        req.once('error', next);
        // add 'close and 'aborted' event handlers so that requests (and their
        // corresponding memory) don't leak if client stops sending data half
        // way through a POST request
        req.once('close', next);
        req.once('aborted', next);
        req.resume();
    }

    return readBody;
}

module.exports = bodyReader;
