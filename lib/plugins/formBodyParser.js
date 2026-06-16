// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var querystring = require('qs');

var bodyReader = require('./bodyReader');
var errors = require('restify-errors');

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
 * @public
 * @function urlEncodedBodyParser
 * @param   {Object}    options - an option sobject
 * @returns {Function} Handler
 */
function urlEncodedBodyParser(options) {
    var opts = options || {};
    assert.object(opts, 'opts');

    var override = opts.overrideParams;

    function parseUrlEncodedBody(req, res, next) {
        // save original body on req.rawBody and req._body
        req.rawBody = req._body = req.body;

        if (req.getContentType() !== MIME_TYPE || !req.body) {
            next();
            return;
        }

        try {
            var params = querystring.parse(req.body);

            if (opts.mapParams === true) {
                var keys = Object.keys(params);
                keys.forEach(function forEach(k) {
                    var p = req.params[k];

                    if (p && !override) {
                        return;
                    }
                    req.params[k] = params[k];
                });
            }

            req.body = params;
        } catch (e) {
            next(new errors.InvalidContentError(e.message));
            return;
        }

        req.log.trace('req.params now: %j', req.params);
        next();
    }

    var chain = [];

    if (!opts.bodyReader) {
        chain.push(bodyReader(opts));
    }
    chain.push(parseUrlEncodedBody);
    return chain;
}

module.exports = urlEncodedBodyParser;
