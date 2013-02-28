// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');



/**
 * Cleans up sloppy URL paths, like /foo////bar/// to /foo/bar.
 *
 * @param {String} path the HTTP resource path.
 * @return {String} Cleaned up form of path.
 */
function sanitizePath(path) {
        assert.ok(path);

        // Be nice like apache and strip out any //my//foo//bar///blah
        path = path.replace(/\/\/+/g, '/');

        // Kill a trailing '/'
        if (path.lastIndexOf('/') === (path.length - 1) && path.length > 1)
                path = path.substr(0, path.length - 1);

        return (path);
}



/**
 * Return a shallow copy of the given object;
 */
function shallowCopy(obj) {
        if (!obj) {
                return (obj);
        }
        var copy = {};
        Object.keys(obj).forEach(function (k) {
                copy[k] = obj[k];
        });
        return (copy);
}



///--- Exports

module.exports = {
        sanitizePath: sanitizePath,
        shallowCopy: shallowCopy
};
