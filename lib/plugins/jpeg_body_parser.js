// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var Buffer = require('buffer').Buffer;

var errors = require('../errors');


///--- Globals

var BadDigestError = errors.BadDigestError;
var InvalidContentError = errors.InvalidContentError;



///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is image/jpeg.
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function jpegBodyParser(options) {
  if (options && typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (!options)
    options = {};

  return function parseJpegBody(req, res, next) {
    if (req.contentType !== 'image/jpeg' ||
        (req.contentLength === 0 && !req.chunked))
      return next();

    var hash;
    if (req.header('content-md5'))
      hash = crypto.createHash('md5');

    req.body = new Buffer(0);
    req.on('data', function (chunk) {
      req.body = Buffer.concat([req.body, chunk]);
      if (hash)
        hash.update(chunk);
    });
    req.on('error', function (err) {
      return next(err);
    });
    req.on('end', function () {
      if (!req.body)
        return next();

      if (hash && req.header('content-md5') !== hash.digest('base64'))
        return next(new BadDigestError('Content-MD5 did not match'));

      if (req.body.toString('hex', 0, 4) !== 'ffd8ffe0')
        return next(new InvalidContentError('Invalid JPEG file'));

      try {
        if (options.mapParams !== false) {
          req.params.jpeg = req.body;
        } else {
          req._body = req.body;
          req.body = req.params;
        }
      } catch (e) {
        return next(new InvalidContentError(e.message));
      }

      req.log.trace('req.params now: %j', req.params);
      return next();
    });

    return false;
  };
}

module.exports = jpegBodyParser;
