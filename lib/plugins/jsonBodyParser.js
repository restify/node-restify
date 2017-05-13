// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var errors = require('restify-errors');

var bodyReader = require('./bodyReader');


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
    var opts = options || {};

    var override = opts.overrideParams;

    function parseJson(req, res, next) {
        // save original body on req.rawBody and req._body
        req.rawBody = req._body = req.body;

        if (req.getContentType() !== 'application/json' || !req.body) {
            return next();
        }

        var params;

        try {
            params = JSON.parse(req.body, opts.reviver);
        } catch (e) {
            return next(new errors.InvalidContentError('Invalid JSON: ' +
                e.message));
        }

        if (opts.mapParams === true) {
            if (Array.isArray(params)) {
                // if req.params exists, we have url params. we can't map an
                // array safely onto req.params, throw an error.
                if (req.params &&
                    Object.keys(req.params).length > 0 &&
                    !(req.params instanceof Array)) {
                    return next(new errors.InternalServerError(
                        'Cannot map POST body of [Array array] onto req.params'
                    ));
                }
                req.params = params;
            } else if (typeof (params) === 'object' && params !== null) {
                // else, try to merge the objects
                Object.keys(params).forEach(function (k) {
                    var p = req.params[k];

                    if (p && !override) {
                        return;
                    }
                    req.params[k] = params[k];
                });
            } else {
                // otherwise, do a wholesale stomp, no need to merge one by one.
                req.params = params || req.params;
            }
        }

        req.body = params;

        return next();
    }

    var chain = [];

    if (!opts.bodyReader) {
        chain.push(bodyReader(opts));
    }
    chain.push(parseJson);
    return chain;
}

module.exports = jsonBodyParser;
