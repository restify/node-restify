// Copyright 2012 Mark Cavage, Inc.  All rights reserved.



///--- Helpers

/**
 * Cleans up sloppy URLs on the request object, like /foo////bar/// to /foo/bar.
 *
 */
function strip(path) {
        var cur;
        var next;
        var str = '';

        for (var i = 0; i < path.length; i++) {
                cur = path.charAt(i);
                if (i !== path.length - 1)
                        next = path.charAt(i + 1);

                if (cur === '/' && (next === '/' || (next === '?' && i > 0)))
                        continue;

                str += cur;
        }

        return (str);
}



///--- Exports

module.exports = function sanitizePath(options) {
        options = options || {};

        function _sanitizePath(req, res, next) {
                req.url = strip(req.url);
                next();
        }

        return (_sanitizePath);
};
