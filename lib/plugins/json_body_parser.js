// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');

var errors = require('../errors');



///--- Globals

var BadDigestError = errors.BadDigestError;
var InvalidContentError = errors.InvalidContentError;
var RequestEntityTooLargeError = errors.RequestEntityTooLargeError;



///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is application/json.
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function jsonBodyParser(options) {
  if (options && typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (!options)
    options = {};

  return function parseJson(req, res, next) {
    if (req.contentType !== 'application/json' ||
        (req.contentLength === 0 && !req.chunked))
      return next();

    var hash;
    if (req.header('content-md5'))
      hash = crypto.createHash('md5');

    var bytesReceived = 0, maxBodySize = options.maxBodySize || 0;
    req.body = '';
    req.on('data', function (chunk) {
      bytesReceived += chunk.length;
      if (maxBodySize && bytesReceived > maxBodySize)
        return;
      req.body += chunk.toString('utf8');
    });
    req.on('error', function (err) {
      return next(err);
    });
    req.on('end', function () {
      if (maxBodySize && bytesReceived > maxBodySize)
        return next(new RequestEntityTooLargeError('Request body size exceeds '
                                                   + maxBodySize));

      if (!req.body)
        return next();

      if (hash) {
        hash.update(req.body);
        var digest = hash.digest('base64');
        if (req.header('content-md5') !== digest) {
          return next(new BadDigestError('Content-MD5 did not match'));
        }
      }

      try {
        var params = JSON.parse(req.body);

        if (options.mapParams !== false) {
          if (Array.isArray(params)) {
            req.params = params;
          } else if (typeof (params) === 'object') {
            Object.keys(params).forEach(function (k) {
              if (req.params[k] && !options.overrideParams) {
                req.log.warn('%s is a URL parameter, but was in the body', k);
                return;
              }
              req.params[k] = params[k];
            });
          } else {
            req.params = params;
          }
        } else {
          req._body = req.body;
          req.body = params;
        }
      } catch (e) {
        return next(new InvalidContentError('Invalid JSON: ' + e.message));
      }

      req.log.trace('req.params now: %j', req.params);
      return next();
    });

    return false;
  };
}

module.exports = jsonBodyParser;
