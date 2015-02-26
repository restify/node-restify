// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var qs = require('qs');
var url = require('url');

var assert = require('assert-plus');


/**
 * Returns a plugin that will parse the query string, and merge the results
 * into req.params.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function queryParser(options) {
    if (!options)
        options = {};
    assert.object(options, 'options');


    function parseQueryString(req, res, next) {
        if (!req.getQuery()) {
            req.query = {};
            return (next());
        }

        req._query = req.query = qs.parse(req.getQuery());
        if (options.mapParams !== false) {
            Object.keys(req.query).forEach(function (k) {
                if (req.params[k] && !options.overrideParams)
                    return (false);

                req.params[k] = req.query[k];
                return (true);
            });
        }

        return (next());
    }

    return (parseQueryString);
}

module.exports = queryParser;
