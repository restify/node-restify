// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var zlib = require('zlib');

var assert = require('assert-plus');



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
                res._end = res.end;
                res.end = gz.end.bind(gz);

                res.setHeader('Content-Encoding', 'gzip');
                next();
        }

        return (gzip);
}



///--- Exports

module.exports = gzipResponse;
