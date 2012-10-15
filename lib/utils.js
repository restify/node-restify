// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');


// The following two functions are courtesy of expressjs
// as is req.accepts(), and req.is() below.
//
// https://github.com/visionmedia/express

function quality(str) {
        var parts = str.split(/ *; */);
        var val = parts[0];
        var q = parts[1] ? parseFloat(parts[1].split(/ *= */)[1]) : 1;

        return ({value: val, quality: q});
}


/**
 * Parses an HTTP header string with quality values into a sorted array
 *
 * @param {String} str header value
 */
function parseQuality(str) {
        /* JSSTYLED */
        str = str.split(/ *, */).map(quality).filter(function (obj) {
                return (obj.quality);
        }).sort(function (a, b) {
                return (b.quality - a.quality);
        });

        return (str);
}


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



///--- Exports

module.exports = {
        parseQuality: parseQuality,
        sanitizePath: sanitizePath
};