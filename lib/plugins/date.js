// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var errors = require('restify-errors');


///--- Globals

var InvalidHeaderError = errors.InvalidHeaderError;
var RequestExpiredError = errors.RequestExpiredError;

var BAD_MSG = 'Date header is invalid';
var OLD_MSG = 'Date header %s is too old';


///--- API

/**
 * Returns a plugin that will parse the Date header (if present) and check for
 * an "expired" request, where expired means the request originated at a time
 * before ($now - $clockSkew). The default clockSkew allowance is 5m (thanks
 * Kerberos!)
 * @public
 * @function dateParser
 * @throws   {RequestExpiredError | InvalidHeaderError}
 * @param    {Number}    clockSkew optional age of time (in seconds).
 * @returns  {Function}            restify handler.
 */
function dateParser(clockSkew) {

    var normalizedClockSkew = clockSkew || 300;
    assert.number(normalizedClockSkew, 'normalizedClockSkew');

    normalizedClockSkew = normalizedClockSkew * 1000;

    function parseDate(req, res, next) {
        if (!req.headers.date) {
            return (next());
        }

        var e;
        var date = req.headers.date;
        var log = req.log;

        try {
            var now = Date.now();
            var sent = new Date(date).getTime();

            if (log.trace()) {
                log.trace({
                    allowedSkew: normalizedClockSkew,
                    now: now,
                    sent: sent
                }, 'Checking clock skew');
            }

            if ((now - sent) > normalizedClockSkew) {
                e = new RequestExpiredError(OLD_MSG, date);
                return (next(e));
            }


        } catch (err) {
            log.trace({
                err: err
            }, 'Bad Date header: %s', date);

            e = new InvalidHeaderError(BAD_MSG, date);
            return (next(e));
        }

        return (next());
    }

    return (parseDate);
}

module.exports = dateParser;
