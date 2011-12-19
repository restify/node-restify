// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var BadRequestError = require('../errors').BadRequestError;


/**
 * Returns a plugin that will parse the Date header (if present) and check for
 * an "expired" request, where expired means the request originated at a time
 * before ($now - $clockSkew). The default clockSkew allowance is 5m (thanks
 * Kerberos!)
 *
 * @param {Number} clockSkew optional age of time (in seconds).
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function dateParser(clockSkew) {
  if (!clockSkew)
    clockSkew = 300;
  if (typeof(clockSkew) !== 'number')
    throw new TypeError('clockSkew (Number) required');

  if (typeof(clockSkew) !== 'number')
    throw new TypeError('clockSkew (Number) required');

  clockSkew = clockSkew * 1000;

  return function parseDate(req, res, next) {
    if (req.headers.date) {
      try {
        var date = new Date(req.headers.date);
        var now = new Date();

        if (req.log.isTraceEnabled())
          req.log.trace('Date: sent=%d, now=%d, allowed=%d',
                        date.getTime(), now.getTime(), clockSkew);

        if ((now.getTime() - date.getTime()) > clockSkew)
          return next(new BadRequestError('Date header is too old'));

      } catch (e) {
        if (req.log.isTraceenabled())
          req.log.trace('Bad Date header: %s' + e.stack);

        return next(new BadRequestError('Date header is invalid'));
      }
    }

    return next();
  };
}

module.exports = dateParser;
