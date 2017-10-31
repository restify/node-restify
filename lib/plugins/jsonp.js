// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var qs = require('qs');

///--- API

/**
 * Parses the jsonp callback out of the request.
 * Supports checking the query string for `callback` or `jsonp` and ensuring
 * that the content-type is appropriately set if JSONP params are in place.
 * There is also a default `application/javascript` formatter to handle this.
 *
 * You *should* set the `queryParser` plugin to run before this, but if you
 * don't this plugin will still parse the query string properly.
 *
 * @public
 * @function jsonp
 * @returns  {Function} Handler
 * @example
 * var server = restify.createServer();
 * server.use(restify.plugins.jsonp());
 */
function jsonp() {
    function _jsonp(req, res, next) {
        var q = req.getQuery();

        // If the query plugin wasn't used, we need to hack it in now
        if (typeof q === 'string') {
            req.query = qs.parse(q);
        }

        if (req.query.callback || req.query.jsonp) {
            res.setHeader('Content-Type', 'application/javascript');
        }

        next();
    }

    return _jsonp;
}

module.exports = jsonp;
