// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

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
  if (!acceptable)
    throw new TypeError('acceptable ([String]) required');
  if (!Array.isArray(acceptable))
    acceptable = [acceptable];

  acceptable.forEach(function (a) {
    if (typeof (a) !== 'string')
      throw new TypeError('acceptable ([String]) required');
  });

  return function parseAccept(req, res, next) {
    for (var i = 0; i < acceptable.length; i++) {
      if (req.accepts(acceptable[i]))
        return next();
    }

    return next(new NotAcceptableError('Server accepts: ' + acceptable.join()));
  };
}

module.exports = acceptParser;
