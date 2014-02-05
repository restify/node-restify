// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var mime = require('mime');

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

    acceptable = acceptable.filter(function (a) {
        return (a);
    }).map(function (a) {
            return ((a.indexOf('/') === -1) ? mime.lookup(a) : a);
        }).filter(function (a) {
            return (a);
        });

    var e = new NotAcceptableError('Server accepts: ' + acceptable.join());

    function parseAccept(req, res, next) {
        if (req.accepts(acceptable)) {
            next();
            return;
        }

        res.json(e);
        next(false);
    }

    return (parseAccept);
}

module.exports = acceptParser;
