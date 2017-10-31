/*
oauth2TokenParser - Parser oauth2 tokens from the authorization header
or BODY of the request

If parsing from the BODY there is adependency on the bodyParser plugin:

server.use(plugins.bodyParser());
server.use(plugins.oauth2TokenParser());


*/
'use strict';

var errors = require('restify-errors');

/*

  Parses the header for the authorization: bearer

*/
function parseHeader(req) {
    if (req.headers && req.headers.authorization) {
        var credentialsIndex = 1;
        var parts = req.headers.authorization.split(' ');
        var partsExpectedLength = 2;
        var schemeIndex = 0;

        if (parts.length === partsExpectedLength) {
            var credentials = parts[credentialsIndex];
            var scheme = parts[schemeIndex];

            if (/^Bearer$/i.test(scheme)) {
                return credentials;
            }
        }
    }

    return null;
}

/**
 * Returns a plugin that will parse the client's request for an OAUTH2
   access token
 *
 * Subsequent handlers will see `req.oauth2`, which looks like:
 *
 * ```js
 * {
 *   oauth2: {
        accessToken: 'mF_9.B5f-4.1JqM&p=q'
    }
 * }
 * ```
 *
 * @public
 * @function oauth2TokenParser
 * @throws   {InvalidArgumentError}
 * @param    {Object} options - an options object
 * @returns  {Function} Handler
 */
function oauth2TokenParser(options) {
    function parseOauth2Token(req, res, next) {
        req.oauth2 = { accessToken: null };

        var tokenFromHeader = parseHeader(req);

        if (tokenFromHeader) {
            req.oauth2.accessToken = tokenFromHeader;
        }

        var tokenFromBody = null;

        if (typeof req.body === 'object') {
            tokenFromBody = req.body.access_token;
        }

        // more than one method to transmit the token in each request
        // is not allowed - return 400
        if (tokenFromBody && tokenFromHeader) {
            // eslint-disable-next-line new-cap
            return next(
                new errors.makeErrFromCode(400, 'multiple tokens disallowed')
            );
        }

        if (
            tokenFromBody &&
            req.contentType().toLowerCase() ===
                'application/x-www-form-urlencoded'
        ) {
            req.oauth2.accessToken = tokenFromBody;
        }

        return next();
    }

    return parseOauth2Token;
}

module.exports = oauth2TokenParser;
