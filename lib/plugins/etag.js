var errors = require('../errors');

///--- Globals

var PreconditionFailedError = errors.PreconditionFailedError;



/**
 * Returns a plugin that will generate an ETag for resources and check if it
 * matches with the client's ETag header.
 *
 * @param {Function} ETag generation function.
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */

function eTagChecker(generator) {
  if (!generator || typeof generator != 'function')
    throw new TypeError('generator (Function) required');

  return function checkETag(req, res, next) {
    var etag = generator(req);
    if (!etag || typeof etag != 'string' || etag.length == 0)
      return next();

    if (req.headers["if-none-match"]) {
      // RFC: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.26
      
      var clientETags = req.headers["if-none-match"].split(/\s*,\s*/);
      var currentETag;

      for (i = 0; i < clientETags.length; i++) {
        // ignore weak validation yet
        currentETag = clientETags[i].replace(/^W\//, '').replace(/^"(\w*)"$/, '$1');

        if (currentETag == "*" || currentETag === etag) {
          if (req.method == 'GET' || req.method == 'HEAD')
            return res.send(304);
          return next(new PreconditionFailedError());
        }
      }
    }

    res.header('ETag', etag);
    return next();
  };
}

module.exports = eTagChecker;
