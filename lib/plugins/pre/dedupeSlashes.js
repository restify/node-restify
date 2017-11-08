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
        req.url = req.url.replace(/(\/)\/+/g, '$1');
        return next();
    };
}

module.exports = createDedupeSlashes;
