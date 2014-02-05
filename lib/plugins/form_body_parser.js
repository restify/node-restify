// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');

var assert = require('assert-plus');
var querystring = require('qs');

var bodyReader = require('./body_reader');
var errors = require('../errors');


///--- Globals

var MIME_TYPE = 'application/x-www-form-urlencoded';


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
function urlEncodedBodyParser(options) {
    options = options || {};
    assert.object(options, 'options');

    var override = options.overrideParams;

    function parseUrlEncodedBody(req, res, next) {
        if (req.getContentType() !== MIME_TYPE || !req.body) {
            next();
            return;
        }

        try {
            var params = querystring.parse(req.body);
            if (options.mapParams !== false) {
                var keys = Object.keys(params);
                keys.forEach(function (k) {
                    var p = req.params[k];
                    if (p && !override)
                        return (false);

                    req.params[k] = params[k];
                    return (true);
                });
            } else {
                req._body = req.body;
                req.body = params;
            }
        } catch (e) {
            next(new errors.InvalidContentError(e.message));
            return;
        }

        req.log.trace('req.params now: %j', req.params);
        next();
    }

    var chain = [];
    if (!options.bodyReader)
        chain.push(bodyReader(options));
    chain.push(parseUrlEncodedBody);
    return (chain);
}

module.exports = urlEncodedBodyParser;
