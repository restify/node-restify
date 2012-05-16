// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');

var args = require('../args');
var errors = require('../errors');



///--- Globals

var BadDigestError = errors.BadDigestError;
var InvalidContentError = errors.InvalidContentError;

var MD5_MSG = 'Content-MD5 \'%s\' didn\'t match \'%s\'';



///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is application/x-www-form-urlencoded.
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function jsonBodyParser(options) {
        options = options || {};
        args.assertObject('options', options);

        var override = options.overrideParams;

        function parseJson(req, res, next) {
                if (req.getContentType() !== 'application/json' ||
                    (req.getContentLength() === 0 && !req.isChunked()))
                        return (next());

                var digest;
                var err;
                var hash;
                var md5;
                if ((md5 = req.header('content-md5')))
                        hash = crypto.createHash('md5');

                req.body = '';
                req.setEncoding('utf8');
                req.on('data', function (chunk) {
                        req.body += chunk;
                        if (hash)
                                hash.update(chunk);
                });

                req.once('error', function (err2) {
                        return (next(err2));
                });

                req.on('end', function () {
                        if (!req.body)
                                return (next());

                        if (hash && md5 !== (digest = hash.digest('base64'))) {
                                err = new BadDigestError(MD5_MSG, md5, digest);
                                return (next(err));
                        }


                        var params;
                        try {
                                params = JSON.parse(req.body);
                        } catch (e) {
                                e = new InvalidContentError('Invalid ' +
                                                            'JSON: ' +
                                                            e.message);
                                return (next(e));
                        }

                        if (options.mapParams !== false) {
                                if (Array.isArray(params)) {
                                        req.params = params;
                                } else if (typeof (params) === 'object') {
                                        var keys = Object.keys(params);
                                        keys.forEach(function (k) {
                                                var p = req.params[k];
                                                if (p && !override)
                                                        return (false);
                                                req.params[k] = params[k];
                                                return (true);
                                        });
                                } else {
                                        req.params = params;
                                }
                        } else {
                                req._body = req.body;
                                req.body = params;
                        }

                        return (next());
                });

                return (false);
        }

        return (parseJson);
}

module.exports = jsonBodyParser;
