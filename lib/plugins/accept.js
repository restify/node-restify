// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var mime = require('mime');

var NotAcceptableError = require('restify-errors').NotAcceptableError;

/**
 * Parses the `Accept` header, and ensures that the server can respond to what
 * the client asked for. In almost all cases passing in `server.acceptable` is
 * all that's required, as that's an array of content types the server knows
 * how to respond to (with the formatters you've registered). If the request is
 * for a non-handled type, this plugin will return a `NotAcceptableError` (406).
 *
 * Note you can get the set of types allowed from a restify server by doing
 * `server.acceptable`.
 *
 * @public
 * @function acceptParser
 * @throws   {NotAcceptableError}
 * @param    {String[]}    accepts - array of accept types.
 * @returns  {Function}              restify handler.
 * @example
 * server.use(restify.plugins.acceptParser(server.acceptable));
 */
function acceptParser(accepts) {
    var acceptable = accepts;

    if (!Array.isArray(acceptable)) {
        acceptable = [acceptable];
    }
    assert.arrayOfString(acceptable, 'acceptable');

    acceptable = acceptable
        .filter(function filter(a) {
            return a;
        })
        .map(function map(a) {
            return a.indexOf('/') === -1 ? mime.lookup(a) : a;
        })
        .filter(function filter(a) {
            return a;
        });

    var e = new NotAcceptableError('Server accepts: ' + acceptable.join());

    function parseAccept(req, res, next) {
        if (req.accepts(acceptable)) {
            return next();
        }
        return next(e);
    }

    return parseAccept;
}

module.exports = acceptParser;
