// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var zlib = require('zlib');

var assert = require('assert-plus');

/**
 * @private
 * @function _writeHead
 * @param   {Function}  originalFunction - originalFunction
 * @returns {undefined} no return value
 */
function _writeHead(originalFunction) {
    this.removeHeader('Content-Length');
    var argsLength = arguments.length;
    var args = new Array(argsLength - 1);

    for (var i = 1; i < argsLength; i++) {
        args[i - 1] = arguments[i];
    }
    originalFunction.apply(this, args);
}

///--- API

/**
 * If the client sends an `accept-encoding: gzip` header (or one with an
 * appropriate q-val), then the server will automatically gzip all
 * response data.
 * Note that only `gzip` is supported, as this is most widely supported by
 * clients in the wild.
 * This plugin will overwrite some of the internal streams, so any
 * calls to `res.send`, `res.write`, etc., will be compressed.  A side effect is
 * that the `content-length` header cannot be known, and so
 * `transfer-encoding: chunked` will *always* be set when this is in effect.
 * This plugin has no impact if the client does not send
 * `accept-encoding: gzip`.
 *
 * https://github.com/restify/node-restify/issues/284
 *
 * @public
 * @function gzipResponse
 * @param   {Object}   [opts] - an options object, see: zlib.createGzip
 * @returns {Function} Handler
 * @example
 * server.use(restify.plugins.gzipResponse());
 */
function gzipResponse(opts) {
    assert.optionalObject(opts, 'options');

    function gzip(req, res, next) {
        if (!req.acceptsEncoding('gzip')) {
            next();
            return;
        }

        var gz = zlib.createGzip(opts);

        gz.on('data', res.write.bind(res));
        gz.once('end', res.end.bind(res));
        gz.on('drain', res.emit.bind(res, 'drain'));

        var origWrite = res.write;
        var origEnd = res.end;
        var origWriteHead = res.writeHead;
        res.handledGzip = function _handledGzip() {
            res.write = origWrite;
            res.end = origEnd;
            res.writeHead = origWriteHead;
        };

        res.write = gz.write.bind(gz);
        res.end = gz.end.bind(gz);

        res.writeHead = _writeHead.bind(res, res.writeHead);
        res.setHeader('Content-Encoding', 'gzip');
        next();
    }

    return gzip;
}

///--- Exports

module.exports = gzipResponse;
