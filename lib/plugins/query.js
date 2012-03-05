// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var qs = require('qs');
var url = require('url');



/**
 * Returns a plugin that will parse the query string, and merge the results
 * into req.params.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function queryParser(options) {
  if (options && typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (!options)
    options = {};

  return function parseQueryString(req, res, next) {
    var u = url.parse(req.url);
    if (u.query) {
      var query = qs.parse(u.query);
      req._query = query;
      if (options.mapParams !== false) {
        Object.keys(query).forEach(function (k) {
          if (req.params[k] && !options.overrideParams) {
            req.log.warn('%s is on both the URL and the querystring', k);
            return;
          }

          req.params[k] = query[k];
        });
      }
    }

    if (!req._query)
      req._query = {};

    req.log.trace('req.params now: %j', req.params);

    return next();
  };
}

module.exports = queryParser;
