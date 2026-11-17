'use strict';

/**
 * This plugin deduplicates extra slashes found in the URL. This can help with
 * malformed URLs that might otherwise get misrouted.
 *
 * @public
 * @function dedupeSlashes
 * @returns {Function} Handler
 * @example
 * server.pre(restify.plugins.pre.dedupeSlashes());
 * server.get('/hello/:one', function(req, res, next) {
 *     res.send(200);
 *     return next();
 * });
 *
 * // the server will now convert requests to /hello//jake => /hello/jake
 */
function createDedupeSlashes() {
    return function dedupeSlashes(req, res, next) {
        // only dedupe the path. The query string (and a fragment, if a
        // client sends one) can hold // legitimately, for example
        // ?next=http://example.com
        var url = req.url;
        var end = url.search(/[?#]/);
        var path = end === -1 ? url : url.slice(0, end);
        var rest = end === -1 ? '' : url.slice(end);

        req.url = path.replace(/(\/)\/+/g, '$1') + rest;
        return next();
    };
}

module.exports = createDedupeSlashes;
