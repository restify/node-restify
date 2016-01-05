'use strict';

///--- Exports

/**
 * JSON formatter.
 * @public
 * @function formatJSON
 * @param    {Object} req  the request object (not used)
 * @param    {Object} res  the response object
 * @param    {Object} body response body
 * @param    {Function} cb cb
 * @returns  {String}
 */
function formatJSON(req, res, body, cb) {
    var data = body ? JSON.stringify(body) : '';
    res.setHeader('Content-Length', Buffer.byteLength(data));

    return cb(null, data);
}

module.exports = formatJSON;
