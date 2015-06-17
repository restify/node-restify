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
    if (!options) {
        options = {};
    }
    assert.object(options, 'options');


    function parseQueryString(req, res, next) {
        if (!req.getQuery()) {
            req.query = {};
            return (next());
        }

        req.query = qs.parse(req.getQuery());

        if (options.mapParams !== false) {
            Object.keys(req.query).forEach(function (k) {
                if (req.params[k] && !options.overrideParams) {
                    return (false);
                }

                req.params[k] = req.query[k];
                return (true);
            });
        }

        return (next());
    }

    return (parseQueryString);
}

module.exports = queryParser;
