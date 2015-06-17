// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');

var bodyReader = require('./body_reader');
var errors = require('../errors');


///--- API

/**
 * parses json body from the request.
 * @public
 * @function jsonBodyParser
 * @param    {Object}               options an options object
 * @throws   {InvalidContentError}          on bad input
 * @returns  {Function}
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
            params = JSON.parse(req.body, options.reviver);
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

                    if (p && !override) {
                        return (false);
                    }
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

    if (!options.bodyReader) {
        chain.push(bodyReader(options));
    }
    chain.push(parseJson);
    return (chain);
}

module.exports = jsonBodyParser;
