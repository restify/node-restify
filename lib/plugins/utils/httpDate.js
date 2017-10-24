// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

/**
 * Takes an instance of a date object, formats it UTC
 * e.g., Wed, 17 Jun 2015 01:30:26 GMT.
 *
 * @public
 * @function httpDate
 * @param    {Object} now - a date object
 * @returns  {String}       formatted dated object
 */
module.exports = function httpDate(now) {
    return now.toUTCString();
};
