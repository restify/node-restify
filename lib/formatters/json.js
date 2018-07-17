// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

/**
 * JSON formatter. Will look for a toJson() method on the body. If one does not
 * exist then a JSON.stringify will be attempted.
 *
 * @public
 * @function formatJSON
 * @param    {Object} req - the request object (not used)
 * @param    {Object} res - the response object
 * @param    {Object} body - response body
 * @returns  {String} data
 */
function formatJSON(req, res, body) {
    // falsy values like 0, false, null, are valid JSON. empty string or
    // undefined are coerced to null, but attempt to stringify everything else.

    // formatter errors are currently fatal - there is no mechanism to
    // communicate a formatter error. no need for try/catch here. default to
    // value of null
    var data =
        body !== '' || typeof body !== 'undefined'
            ? JSON.stringify(body)
            : 'null';

    // TODO: setting the content-length header is not a formatting feature and
    // should be separated into another module
    res.setHeader('Content-Length', Buffer.byteLength(data));

    return data;
}

module.exports = formatJSON;
