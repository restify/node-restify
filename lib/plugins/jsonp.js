// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var qs = require('qs');


///--- API

/**
 * parses the jsonp callback out of the request.
 * @public
 * @function jsonp
 * @returns  {Function}
 */
function jsonp() {
    function _jsonp(req, res, next) {
        var q = req.getQuery();

        // If the query plugin wasn't used, we need to hack it in now
        if (typeof (q) === 'string') {
            req.query = qs.parse(q);
        }

        if (req.query.callback || req.query.jsonp) {
            res.setHeader('Content-Type', 'application/javascript');
        }

        next();
    }

    return (_jsonp);
}


module.exports = jsonp;
