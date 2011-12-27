// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var querystring = require('querystring');
var url = require('url');



/**
 * Returns a plugin that will parse the query string, and merge the results
 * into req.params.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function queryParser() {

  return function parseQueryString(req, res, next) {
    var u = url.parse(req.url);
    if (u.query) {
      var qs = querystring.parse(u.query);
      Object.keys(qs).forEach(function(k) {
        if (req.params[k]) {
          req.log.warn('%s is a URL parameter, but was on the querystring', k);
          return;
        }
        req.params[k] = qs[k];
      });
    }

    if (req.log.isTraceEnabled())
      req.log.trace('req.params now: %j', req.params);
    return next();
  };
}

module.exports = queryParser;
