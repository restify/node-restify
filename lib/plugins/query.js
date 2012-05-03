// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var qs = require('qs');
var url = require('url');

var args = require('../args');



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
        args.assertObject('options', options);


        function parseQueryString(req, res, next) {
                if (!req.getQuery())
                        return (next());

                req.query = qs.parse(req.getQuery());
                if (options.mapParams !== false) {
                        Object.keys(req.query).forEach(function (k) {
                                if (req.params[k] && !options.overrideParams)
                                        return (false);

                                req.params[k] = req.query[k];
                                return (true);
                        });
                } else {
                        req.query = {};
                }

                return (next());
        }

        return (parseQueryString);
}

module.exports = queryParser;
