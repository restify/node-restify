// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');

var bodyReader = require('./body_reader');
var errors = require('../errors');


///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is application/json.
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function jsonBodyParser(options) {
    assert.optionalObject(options, 'options');
    options = options || {};

    var override = options.overrideParams;

    function parseJson(req, res, next) {
        if (req.getContentType() !== 'application/json' || !req.body) {
            next();
            return;
        }

        var params;
        try {
            params = JSON.parse(req.body);
        } catch (e) {
            next(new errors.InvalidContentError('Invalid JSON: ' +
                e.message));
            return;
        }

        if (options.mapParams !== false) {
            if (Array.isArray(params)) {
                req.params = params;
            } else if (typeof (params) === 'object' && params !== null) {
                Object.keys(params).forEach(function (k) {
                    var p = req.params[k];
                    if (p && !override)
                        return (false);
                    req.params[k] = params[k];
                    return (true);
                });
            } else {
                req.params = params || req.params;
            }
        } else {
            req._body = req.body;
        }

        req.body = params;

        next();
    }

    var chain = [];
    if (!options.bodyReader)
        chain.push(bodyReader(options));
    chain.push(parseJson);
    return (chain);
}

module.exports = jsonBodyParser;
