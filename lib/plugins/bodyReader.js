// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var crypto = require('crypto');
var zlib = require('zlib');

var assert = require('assert-plus');
var once = require('once');
var errors = require('restify-errors');

///--- Globals

var BadDigestError = errors.BadDigestError;
var InvalidContentError = errors.InvalidContentError;
var PayloadTooLargeError = errors.PayloadTooLargeError;
var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;

var MD5_MSG = "Content-MD5 '%s' didn't match '%s'";

///--- Helpers

function createPayloadTooLargeError(maxBodySize) {
    var msg = 'Request body size exceeds ' + maxBodySize;
    return new PayloadTooLargeError(msg);
}

function createBodyWriter(req, maxBodySize) {
    var buffers = [];
    var decodedBytes = 0;

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

    req.body = Buffer.alloc(0);
    return {
        write: function write(chunk) {
            decodedBytes += chunk.length;

            if (maxBodySize && decodedBytes > maxBodySize) {
                throw createPayloadTooLargeError(maxBodySize);
            }

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
        var bodyWriter = createBodyWriter(req, maxBodySize);

        var bodyReadFailed = false;
        var bytesReceived = 0;
        var digest;
        var gz;
        var hash;
        var md5;
        var onRequestEnd;

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
                next(createPayloadTooLargeError(maxBodySize));
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

        function failGzipRead(err) {
            if (bodyReadFailed) {
                return;
            }

            bodyReadFailed = true;
            req.removeListener('end', onRequestEnd);
            gz.removeListener('end', done);
            gz.destroy();
            next(err);
        }

        if (req.headers['content-encoding'] === undefined) {
            // This handles the original else branch
            req.once('end', done);
        } else if (req.headers['content-encoding'] === 'gzip') {
            gz = zlib.createGunzip();
            onRequestEnd = gz.end.bind(gz);
            gz.once('error', function onGzipError(err) {
                failGzipRead(new InvalidContentError(err, 'Invalid gzip body'));
            });
            gz.on('data', function onGzipData(chunk) {
                try {
                    bodyWriter.write(chunk);
                } catch (err) {
                    failGzipRead(err);
                }
            });
            gz.once('end', done);
            req.once('end', onRequestEnd);
        } else {
            unsupportedContentEncoding = req.headers['content-encoding'];
            res.setHeader('Accept-Encoding', 'gzip');
            req.once('end', done);
        }

        req.on('data', function onRequestData(chunk) {
            if (bodyReadFailed) {
                return;
            }

            if (maxBodySize) {
                bytesReceived += chunk.length;

                if (bytesReceived > maxBodySize) {
                    if (gz) {
                        failGzipRead(createPayloadTooLargeError(maxBodySize));
                    }
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
        res.once('close', next);
        req.once('aborted', next);
        req.resume();
    }

    return readBody;
}

module.exports = bodyReader;
