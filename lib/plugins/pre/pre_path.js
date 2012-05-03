// Copyright 2012 Mark Cavage, Inc.  All rights reserved.



///--- Helpers

function strip(path) {
        var cur;
        var next;
        var str = '';

        for (var i = 0; i < path.length; i++) {
                cur = path.charAt(i);
                if (i !== path.length - 1)
                        next = path.charAt(i + 1);

                if (cur === '/' && next === '/')
                        continue;

                str += cur;
        }

        return str;
}


/**
 * Cleans up sloppy URLs on the request object, like /foo////bar/// to /foo/bar.
 *
 */
function _sanitizePath(req, res, next) {
        req.url = strip(req.url);
        return (next());
}


///--- Exports

module.exports = function sanitizePath() {
        return (_sanitizePath);
};
