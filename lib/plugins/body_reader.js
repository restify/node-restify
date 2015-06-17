// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var crypto = require('crypto');
var zlib = require('zlib');

var assert = require('assert-plus');

var errors = require('../errors');


///--- Globals

var BadDigestError = errors.BadDigestError;
var RequestEntityTooLargeError = errors.RequestEntityTooLargeError;

var MD5_MSG = 'Content-MD5 \'%s\' didn\'t match \'%s\'';


///--- Helpers

function createBodyWriter(req) {
    var buffers = [];

    var contentType = req.contentType();
    var isText = false;

    if (!contentType ||
        contentType === 'application/json' ||
        contentType === 'application/x-www-form-urlencoded' ||
        contentType === 'multipart/form-data' ||
        contentType.substr(0, 5) === 'text/') {
        isText = true;
    }

    req.body = new Buffer(0);
    return {
        write: function (chunk) {
            buffers.push(chunk);
        },
        end: function () {
            req.body = Buffer.concat(buffers);

            if (isText) {
                req.body = req.body.toString('utf8');
            }
        }
    };
}


///--- API

/**
 * reads the body of the request.
 * @public
 * @function bodyReader
 * @throws   {BadDigestError | RequestEntityTooLargeError}
 * @param    {Object} options an options object
 * @returns  {Function}
 */
function bodyReader(options) {
    options = options || {};
    assert.object(options, 'options');

    var maxBodySize = options.maxBodySize || 0;

    function readBody(req, res, next) {
        if ((req.getContentLength() === 0 && !req.isChunked()) ||
            req.contentType() === 'multipart/form-data' ||
            req.contentType() === 'application/octet-stream') {
            next();
            return;
        }
        var bodyWriter = createBodyWriter(req);

        var bytesReceived = 0;
        var digest;
        var gz;
        var hash;
        var md5;

        if ((md5 = req.headers['content-md5'])) {
            hash = crypto.createHash('md5');
        }

        function done() {
            bodyWriter.end();

            if (maxBodySize && bytesReceived > maxBodySize) {
                var msg = 'Request body size exceeds ' +
                    maxBodySize;
                next(new RequestEntityTooLargeError(msg));
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

        if (req.headers['content-encoding'] === 'gzip') {
            gz = zlib.createGunzip();
            gz.on('data', bodyWriter.write);
            gz.once('end', done);
            req.once('end', gz.end.bind(gz));
        } else {
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
        req.resume();
    }

    return (readBody);
}

module.exports = bodyReader;
