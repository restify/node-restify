// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var zlib = require('zlib');

var assert = require('assert-plus');


function _writeHead(originalFunction) {
    this.removeHeader('Content-Length');
    originalFunction.apply(this, Array.prototype.slice.call(arguments, 1));
}

///--- API

/**
 * gzips the response.
 * https://github.com/restify/node-restify/issues/284
 * @public
 * @function gzipResponse
 * @param   {Object}   opts an options object
 * @returns {Function}
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

    return (gzip);
}


///--- Exports

module.exports = gzipResponse;
