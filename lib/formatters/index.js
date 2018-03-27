// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';
///--- Exports

/**
 * Format a response for being sent over the wire
 *
 * @public
 * @typedef {Function} formatter
 * @param    {Object} req - the request object (not used)
 * @param    {Object} res - the response object
 * @param    {Object} body - response body to format
 * @returns  {String} formatted response data
 */

module.exports = {
    'application/javascript; q=0.1': require('./jsonp'),
    'application/json; q=0.4': require('./json'),
    'text/plain; q=0.3': require('./text'),
    'application/octet-stream; q=0.2': require('./binary')
};
