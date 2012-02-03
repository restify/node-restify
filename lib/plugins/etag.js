var errors = require('../errors');

///--- Globals

var PreconditionFailedError = errors.PreconditionFailedError;



/**
 * Returns a plugin that will compare an already set ETag header with the client's 
 * If-Match and If-None-Match header.
 *
 * @return {Function} restify handler.
 */

function eTagChecker() {
  return function checkETag(req, res, next) {
    var etag = res.header('ETag');
    if (!etag || typeof etag != 'string' || etag.length == 0)
      return next();

    if (req.headers["if-match"]) {
      // RFC: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.24
      
      var clientETags = req.headers["if-match"].split(/\s*,\s*/);
      var currentETag;
      var matched = false;

      for (var i = 0; i < clientETags.length; i++) {
        // only strong comparison
        currentETag = clientETags[i].replace(/^"(\w*)"$/, '$1');

        if (currentETag == "*" || currentETag === etag) {
          matched = true;
          break;
        }
      }

      if (!matched)
        return next(new PreconditionFailedError());
    }

    if (req.headers["if-none-match"]) {
      // RFC: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.26
      
      var clientETags = req.headers["if-none-match"].split(/\s*,\s*/);
      var currentETag;

      for (var i = 0; i < clientETags.length; i++) {
        // ignore weak validation yet
        currentETag = clientETags[i].replace(/^W\//, '').replace(/^"(\w*)"$/, '$1');

        if (currentETag == "*" || currentETag === etag) {
          if (req.method == 'GET' || req.method == 'HEAD')
            return res.send(304);
          return next(new PreconditionFailedError());
        }
      }
    }

    return next();
  };
}

module.exports = eTagChecker;
