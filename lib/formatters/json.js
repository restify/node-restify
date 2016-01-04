'use strict';

var util = require('util');

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
    var data = body ? JSON.stringify(body, findCycle) : '';
    res.setHeader('Content-Length', Buffer.byteLength(data));

    return cb(null, data);
}

var findCycle = function (key, value) {
    var seen = [];
    if (value && typeof value == "object") {
        if (seen.indexOf(value) > -1) {
            console.log("%s: %s", key,value);
            return;
        }
        seen.push(value);
    }
    return value;
};

module.exports = formatJSON;
