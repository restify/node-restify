var errors = require('../errors');

///--- Globals

var PreconditionFailedError = errors.PreconditionFailedError;


///--- Helpers

function isValidDate(d) {
  if (isNaN(Date.parse(d)))
    return false;
  return (new Date(d) < new Date());
}


/**
 * Returns a plugin that will compare an already set ETag header with
 * the client's If-Match and If-None-Match header, and an already set
 * Last-Modified header with the client's If-Modified-Since and
 * If-Unmodified-Since header.
 *
 * @return {Function} restify handler.
 */

function conditionalRequest() {
  return function checkConditions(req, res, next) {
    var clientETags;
    var currentETag;
    var etag = res.header('ETag') || res.etag;
    var clientDate;
    var modified = res.header('Last-Modified');
    var i;
    var matched = false;

    if (typeof (etag) === 'string' && etag.length !== 0) {
      etag =
        etag.replace(/^W\//, '').replace(/^"(\w*)"$/, '$1');

      if (req.headers['if-match']) {
        // RFC: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.24

        /* JSSTYLED */
        clientETags = req.headers['if-match'].split(/\s*,\s*/);

        for (i = 0; i < clientETags.length; i++) {
          // only strong comparison
          /* JSSTYLED */
          currentETag = clientETags[i].replace(/^"(\w*)"$/, '$1');

          if (currentETag === '*' || currentETag === etag) {
            matched = true;
            break;
          }
        }

        if (!matched)
          return next(new PreconditionFailedError('etag didn\'t match'));
      }

      if (req.headers['if-none-match']) {
        // RFC: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.26

        /* JSSTYLED */
        clientETags = req.headers['if-none-match'].split(/\s*,\s*/);

        for (i = 0; i < clientETags.length; i++) {
          // ignore weak validation yet
          currentETag =
            clientETags[i].replace(/^W\//, '').replace(/^"(\w*)"$/, '$1');

          if (currentETag === '*' || currentETag === etag) {
            if (req.method !== 'GET' && req.method !== 'HEAD')
              return next(new PreconditionFailedError('etag matched'));

            res.send(304);
            return next(false);
          }
        }
      }
    }

    if (modified && typeof (modified) === 'string' && isValidDate(modified)) {
      modified = new Date(modified);

      if (req.headers['if-modified-since'] &&
          isValidDate(req.headers['if-modified-since'])) {
        // RFC: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.25

        clientDate = new Date(req.headers['if-modified-since']);
        if (clientDate >= modified) {
          res.send(304);
          return next(false);
        }
      }

      if (req.headers['if-unmodified-since'] &&
          isValidDate(req.headers['if-unmodified-since'])) {
        // RFC: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.28

        clientDate = new Date(req.headers['if-unmodified-since']);
        if (clientDate < modified) {
          return next(new PreconditionFailedError('modified'));
        }
      }
    }

    return next();
  };
}

module.exports = conditionalRequest;
