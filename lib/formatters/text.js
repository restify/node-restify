
'use strict';

///--- Exports

/**
 * Text formatter. Will call the toString() method of the object
 * @public
 * @function formatText
 * @param    {Object} req  the request object (not used)
 * @param    {Object} res  the response object
 * @param    {Object} body response body
 * @param    {Function} cb cb
 * @returns  {String}
 */
function formatText(req, res, body, cb) {
    body = body ? body.toString() : '';
    res.setHeader('Content-Length', Buffer.byteLength(body));
    return cb(null, body);
}

module.exports = formatText;
