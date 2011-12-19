// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var BadRequestError = require('../errors').BadRequestError;


/**
 * Returns a plugin that will parse the client's Authorization header.
 *
 * Subsequent handlers will see `req.authorization`, which looks like:
 *
 * {
 *   scheme: <Basic|Signature|...>,
 *   credentials: <Undecoded value of header>,
 *   basic: {
 *     username: $user
 *     password: $password
 *   }
 * }
 *
 * `req.username` will also be set, and defaults to 'anonymous'.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function authorizationParser() {

  return function parseAuthorization(req, res, next) {
    req.authorization = {};
    req.username = 'anonymous';

    if (!req.headers.authorization)
      return next();

    var pieces = req.headers.authorization.split(' ', 2);
    if (!pieces || pieces.length !== 2)
      return next(new BadRequestError('BasicAuth content is invalid.'));

    req.authorization.scheme = pieces[0];
    req.authorization.credentials = pieces[1];

    if (pieces[0] === 'Basic') {
      var decoded = (new Buffer(pieces[1], 'base64')).toString('utf8');
      if (!decoded)
        return next(new BadRequestError('Authorization header invalid.'));

      if (decoded !== null) {
        var idx = decoded.indexOf(':');
        if (idx === -1) {
          pieces = [decoded];
        } else {
          pieces = [decoded.slice(0, idx), decoded.slice(idx + 1)];
        }
      }

      if (!(pieces !== null ? pieces[0] : null) ||
          !(pieces !== null ? pieces[1] : null))
        return next(new BadRequestError('Authorization header invalid.'));

      req.authorization.basic = {
        username: pieces[0],
        password: pieces[1]
      };
      req.username = pieces[0];
    }

    return next();
  };
}

module.exports = authorizationParser;
