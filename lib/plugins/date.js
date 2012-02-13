// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var errors = require('../errors');


///--- Globals

var InvalidHeaderError = errors.InvalidHeaderError;
var RequestExpiredError = errors.RequestExpiredError;



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
  if (typeof (clockSkew) !== 'number')
    throw new TypeError('clockSkew (Number) required');

  if (typeof (clockSkew) !== 'number')
    throw new TypeError('clockSkew (Number) required');

  clockSkew = clockSkew * 1000;

  return function parseDate(req, res, next) {
    if (req.headers.date) {
      try {
        var date = new Date(req.headers.date);
        var now = new Date();

        req.log.trace('Date: sent=%d, now=%d, allowed=%d',
                      date.getTime(), now.getTime(), clockSkew);

        if ((now.getTime() - date.getTime()) > clockSkew)
          return next(new RequestExpiredError('Date header is too old'));

      } catch (e) {
        req.log.trace({err: e}, 'Bad Date header: %s', req.headers.date);

        return next(new InvalidHeaderError('Date header is invalid'));
      }
    }

    return next();
  };
}

module.exports = dateParser;
