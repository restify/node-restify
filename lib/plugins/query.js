// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var qs = require('qs');
var assert = require('assert-plus');

var EXPOSED_QS_OPTIONS = {
    allowDots: assert.optionalBool,
    arrayLimit: assert.optionalNumber,
    depth: assert.optionalNumber,
    parameterLimit: assert.optionalNumber,
    parseArrays: assert.optionalBool,
    plainObjects: assert.optionalBool,
    strictNullHandling: assert.optionalBool

    /*
     * Exclusions (`qs.parse` options that restify does NOT expose):
     * - `allowPrototypes`: It is strongly suggested against in qs docs.
     * - `decoder`
     * - `delimiter`: For query string parsing we shouldn't support anything
     *   but the default '&'.
     */
};

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

    /*
     * Releases of restify 4.x up to 4.1.1 used qs@3 which effectively defaulted
     * to `plainObjects=true` and `allowDots=true`. To maintain backward
     * compatibility for the restify 4.x stream while using the latest qs
     * version, we need to maintain those defaults. Note that restify-plugins
     * changes back to the pre-restify-4.x behaviour. See test/query.test.js
     * for more details.
     */
    var qsOptions = {
        plainObjects: true,
        allowDots: true
    };
    Object.keys(EXPOSED_QS_OPTIONS).forEach(function (k) {
        EXPOSED_QS_OPTIONS[k](options[k], k); // assert type of this option

        if (options.hasOwnProperty(k)) {
            qsOptions[k] = options[k];
        }
    });

    function parseQueryString(req, res, next) {
        if (!req.getQuery()) {
            req.query = {};
            return (next());
        }

        req.query = qs.parse(req.getQuery(), qsOptions);

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
