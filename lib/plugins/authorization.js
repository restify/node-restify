// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var httpSignature = require('http-signature');

var errors = require('../errors');



///--- Globals

var InvalidHeaderError = errors.InvalidHeaderError;

var httpSignatureOptions = {
  algorithms: [
    'rsa-sha1',
    'rsa-sha256',
    'rsa-sha512',
    'dsa-sha1'
  ]
};



///--- Helpers

function parseBasic(string) {
  var decoded;
  var index;
  var pieces;

  decoded = (new Buffer(string, 'base64')).toString('utf8');
  if (!decoded)
    throw new InvalidHeaderError('Authorization header invalid (not base64)');

  index = decoded.indexOf(':');
  if (index === -1) {
    pieces = [decoded];
  } else {
    pieces = [decoded.slice(0, index), decoded.slice(index + 1)];
  }

  if (!pieces || !pieces[0])
    throw new InvalidHeaderError('Authorization header invalid');

  // Allows for passwordless authentication
  if (!pieces[1])
    pieces[1] = null;

  return {
    username: pieces[0],
    password: pieces[1]
  };
}


function parseSignature(request) {
  try {
    return httpSignature.parseRequest(request, httpSignatureOptions);
  } catch (e) {
    throw new InvalidHeaderError('Authorization header invalid: ' + e.message);
  }
}



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
      return next(new InvalidHeaderError('BasicAuth content is invalid.'));

    req.authorization.scheme = pieces[0];
    req.authorization.credentials = pieces[1];

    try {
      switch (pieces[0].toLowerCase()) {
      case 'basic':
        req.authorization.basic = parseBasic(pieces[1]);
        req.username = req.authorization.basic.username;
        break;

      case 'signature':
        req.authorization.signature = parseSignature(req);
        req.username = req.authorization.signature.keyId;
        break;

      default:
        break;
      }
    } catch (e) {
      return next(e);
    }

    return next();
  };
}

module.exports = authorizationParser;
