// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Helpers


/**
 * Cleans up sloppy URLs on the request object, like /foo////bar/// to /foo/bar.
 * @private
 * @function strip
 * @param    {Object} path a url path to clean up
 * @returns  {String}
 */
function strip(path) {
    var cur;
    var next;
    var str = '';

    for (var i = 0; i < path.length; i++) {
        cur = path.charAt(i);

        if (i !== path.length - 1) {
            next = path.charAt(i + 1);
        }

        if (cur === '/' && (next === '/' || (next === '?' && i > 0))) {
            continue;
        }

        str += cur;
    }

    return (str);
}


/**
 * @public
 * @function sanitizePath
 * @param    {Object}   options an options object
 * @returns  {Function}
 */
function sanitizePath(options) {

    function _sanitizePath(req, res, next) {
        req.url = strip(req.url);
        next();
    }

    return (_sanitizePath);
}


///--- Exports

module.exports = sanitizePath;
