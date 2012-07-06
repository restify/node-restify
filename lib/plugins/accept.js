// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');

var NotAcceptableError = require('../errors').NotAcceptableError;


/**
 * Returns a plugin that will check the client's Accept header can be handled
 * by this server.
 *
 * Note you can get the set of types allowed from a restify server by doing
 * `server.acceptable`.
 *
 * @param {String} array of accept types.
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function acceptParser(acceptable) {
        if (!Array.isArray(acceptable))
                acceptable = [acceptable];
        assert.arrayOfString(acceptable, 'acceptable');

        function parseAccept(req, res, next) {
                for (var i = 0; i < acceptable.length; i++) {
                        if (req.accepts(acceptable[i]))
                                return (next());
                }

                var e = new NotAcceptableError('Server accepts: ' +
                                               acceptable.join());
                res.json(e);
                return (next(false));
        }

        return (parseAccept);
}

module.exports = acceptParser;
