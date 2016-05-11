// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var errs = require('restify-errors');

///--- Exports

/**
 * Formats the body to 'text' by invoking a toString() on the body if it
 * exists. If it doesn't, then the response is a zero-length string
 * @public
 * @function formatText
 * @param    {Object} req  the request object (not used)
 * @param    {Object} res  the response object
 * @param    {Object} body response body. If it has a toString() method this
 * will be used to make the string representation
 * @param    {Function} cb cb
 * @returns  {String}
 */
function formatText(req, res, body, cb) {

    // if body is null, default to empty string
    var data = '';

    if (body && typeof body.toString === 'function') {
        data = body.toString();
    } else {
        // if no toString, or toString isn't a function, this is almost
        // certainly an error. even though we pass back this error, formatter
        // errors won't get sent to the client. this error will get logged on
        // server side, but client gets empty 500 when we have formatter errors
        return cb(new errs.InternalServerError(
            'no toString() method defined, unable to format response'
        ));
    }

    // Setting the content-length header is not a formatting feature and should
    // be separated into another module
    res.setHeader('Content-Length', Buffer.byteLength(data));
    return cb(null, data);
}

module.exports = formatText;
