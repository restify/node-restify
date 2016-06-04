// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';


/**
 * Formats the body to 'text' by invoking a toString() on the body if it
 * exists. If it doesn't, then the response is a zero-length string
 * @public
 * @function formatText
 * @param    {Object} req  the request object (not used)
 * @param    {Object} res  the response object
 * @param    {Object} body response body. If it has a toString() method this
 * will be used to make the string representation
 * @returns  {String}
 */
function formatText(req, res, body) {

    // if body is null, default to empty string
    var data = '';

    data = body.toString();

    // TODO: setting the content-length header is not a formatting
    // feature and should be separated into another module
    res.setHeader('Content-Length', Buffer.byteLength(data));
    return data;
}

module.exports = formatText;
