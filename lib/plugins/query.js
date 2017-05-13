// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var qs = require('qs');
var assert = require('assert-plus');


/**
 * Returns a plugin that will parse the query string, and merge the results
 * into req.query.
 *
 * Unless options.mapParams is false, they will also be mapped into req.params.
 * @public
 * @function queryParser
 * @param    {Object}   options an options object
 * @returns  {Function}
 */
function queryParser(options) {

    var opts = options || {};
    assert.object(opts, 'opts');


    function parseQueryString(req, res, next) {
        if (!req.getQuery()) {
            req.query = {};
            return next();
        }

        req.query = qs.parse(req.getQuery(), opts);

        if (opts.mapParams === true) {
            Object.keys(req.query).forEach(function (k) {
                if (req.params[k] && !opts.overrideParams) {
                    return;
                }
                req.params[k] = req.query[k];
            });
        }

        return next();
    }

    return parseQueryString;
}

module.exports = queryParser;
