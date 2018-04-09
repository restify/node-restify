'use strict';

var errors = require('restify-errors');
var _ = require('lodash');
var assert = require('assert-plus');
var semver = require('semver');
var Negotiator = require('negotiator');
var Chain = require('../chain');

///--- Globals

var InvalidVersionError = errors.InvalidVersionError;
var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;
var DEF_CT = 'application/octet-stream';

///--- Exports

/**
 * Runs first handler that matches to the condition
 *
 * @public
 * @function conditionalHandler
 * @param {Object|Object[]} candidates - candidates
 * @param {Function|Function[]} candidates.handler - handler(s)
 * @param {String|String[]} [candidates.version] - '1.1.0', ['1.1.0', '1.2.0']
 * @param {String} [candidates.contentType] - accepted content type, '*\/json'
 * @returns  {Function} Handler
 * @throws {InvalidVersionError}
 * @throws {UnsupportedMediaTypeError}
 * @example
 * server.use(restify.plugins.conditionalHandler({
 *    contentType: 'application/json',
 *    version: '1.0.0',
 *    handler: function (req, res, next) {
 *        next();
 *    })
 * });
 *
 * server.get('/hello/:name', restify.plugins.conditionalHandler([
 *   {
 *      version: '1.0.0',
 *      handler: function(req, res, next) { res.send('1.x'); }
 *   },
 *   {
 *      version: ['1.5.0', '2.0.0'],
 *      handler: function(req, res, next) { res.send('1.5.x, 2.x'); }
 *   },
 *   {
 *      version: '3.0.0',
 *      contentType: ['text/html', 'text/html']
 *      handler: function(req, res, next) { res.send('3.x, text'); }
 *   },
 *   {
 *      version: '3.0.0',
 *      contentType: 'application/json'
 *      handler: function(req, res, next) { res.send('3.x, json'); }
 *   },
 *   // Array of handlers
 *   {
 *      version: '4.0.0',
 *      handler: [
 *          function(req, res, next) { next(); },
 *          function(req, res, next) { next(); },
 *          function(req, res, next) { res.send('4.x') }
 *      ]
 *   },
 * ]);
 * // 'accept-version': '^1.1.0' => 1.5.x, 2.x'
 * // 'accept-version': '3.x', accept: 'application/json' => '3.x, json'
 */
function conditionalHandler(candidates) {
    var isVersioned = false;
    var isContentTyped = false;

    if (!_.isArray(candidates)) {
        candidates = [candidates];
    }

    // Assert
    assert.arrayOfObject(candidates, 'candidates');
    candidates = candidates.map(function map(candidate) {
        // Array of handlers, convert to chain
        if (_.isArray(candidate.handler)) {
            var chain = new Chain();
            candidate.handler.forEach(function forEach(_handler) {
                assert.func(_handler);
                chain.add(_handler);
            });
            candidate.handler = chain.run.bind(chain);
        }

        assert.func(candidate.handler);

        if (_.isString(candidate.version)) {
            candidate.version = [candidate.version];
        }
        if (_.isString(candidate.contentType)) {
            candidate.contentType = [candidate.contentType];
        }

        assert.optionalArrayOfString(candidate.version);
        assert.optionalArrayOfString(candidate.contentType);

        isVersioned = isVersioned || !!candidate.version;
        isContentTyped = isContentTyped || !!candidate.contentType;

        return candidate;
    });

    /**
     * Conditional Handler
     *
     * @private
     * @param  {Request}  req - request
     * @param  {Response} res - response
     * @param  {Function} next - next
     * @returns {undefined} no return value
     */
    return function _conditionalHandlerFactory(req, res, next) {
        var contentType = req.headers.accept || DEF_CT;
        var reqCandidates = candidates;

        // Content Type
        if (isContentTyped) {
            var contentTypes = contentType.split(/\s*,\s*/);
            reqCandidates = candidates.filter(function filter(candidate) {
                var neg = new Negotiator({
                    headers: {
                        accept: candidate.contentType.join(', ')
                    }
                });
                var tmp = neg.preferredMediaType(contentTypes);
                return tmp && tmp.length;
            });

            if (!reqCandidates.length) {
                next(new UnsupportedMediaTypeError(contentType));
                return;
            }
        }

        // Accept Version
        if (isVersioned) {
            var reqVersion = req.version();
            var maxVersion;
            var maxVersionIndex;

            reqCandidates.forEach(function forEach(candidate, idx) {
                var version = semver.maxSatisfying(
                    candidate.version,
                    reqVersion
                );

                if (version) {
                    if (!maxVersion || semver.gt(version, maxVersion)) {
                        maxVersion = version;
                        maxVersionIndex = idx;
                    }
                }
            });

            // No version find
            if (_.isUndefined(maxVersionIndex)) {
                next(
                    new InvalidVersionError(
                        '%s is not supported by %s %s',
                        req.version() || '?',
                        req.method,
                        req.path()
                    )
                );
                return;
            }

            // Add api-version response header
            res.header('api-version', maxVersion);
            // Store matched version on request internal
            req._matchedVersion = maxVersion;
            // Run handler
            reqCandidates[maxVersionIndex].handler(req, res, next);
            return;
        }

        // When not versioned
        reqCandidates[0].handler(req, res, next);
    };
}

module.exports = conditionalHandler;
