// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

/**
 * JSON formatter. Will look for a toJson() method on the body. If one does not exist
 * then a JSON.stringify will be attempted.
 * @public
 * @function formatJSON
 * @param    {Object} req  the request object (not used)
 * @param    {Object} res  the response object
 * @param    {Object} body response body
 * @param    {Function} cb cb
 * @returns  {String}
 */
function formatJSON(req, res, body, cb) {

    var data = body.toJSON ? body.toJSON() : JSON.stringify(body);
    // Setting the content-length header is not a formatting feature and should be separated into another module
    res.setHeader('Content-Length', Buffer.byteLength(data));

    return cb(null, data);
}

module.exports = formatJSON;
