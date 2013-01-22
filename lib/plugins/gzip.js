// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var zlib = require('zlib');

var assert = require('assert-plus');


function _writeHead(originalFunction) {
        this.removeHeader('Content-Length');
        originalFunction.apply(this, Array.prototype.slice.call(arguments, 1));
}

///--- API

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
