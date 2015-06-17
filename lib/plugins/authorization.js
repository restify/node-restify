// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var httpSignature = require('http-signature');

var errors = require('../errors');


///--- Globals

var InvalidHeaderError = errors.InvalidHeaderError;

var OPTIONS = {
    algorithms: [
        'rsa-sha1',
        'rsa-sha256',
        'rsa-sha512',
        'dsa-sha1',
        'hmac-sha1',
        'hmac-sha256',
        'hmac-sha512'
    ]
};


///--- Helpers

function parseBasic(string) {
    var decoded;
    var index;
    var pieces;

    decoded = (new Buffer(string, 'base64')).toString('utf8');

    if (!decoded) {
        throw new InvalidHeaderError('Authorization header invalid');
    }

    index = decoded.indexOf(':');

    if (index === -1) {
        pieces = [decoded];
    } else {
        pieces = [decoded.slice(0, index), decoded.slice(index + 1)];
    }

    if (!pieces || typeof (pieces[0]) !== 'string') {
        throw new InvalidHeaderError('Authorization header invalid');
    }

    // Allows for usernameless authentication
    if (!pieces[0]) {
        pieces[0] = null;
    }

    // Allows for passwordless authentication
    if (!pieces[1]) {
        pieces[1] = null;
    }

    return ({
        username: pieces[0],
        password: pieces[1]
    });
}


function parseSignature(request, options) {
    options = options || {};
    options.algorithms = OPTIONS.algorithms;

    try {
        return (httpSignature.parseRequest(request, options));
    } catch (e) {
        throw new InvalidHeaderError('Authorization header invalid: ' +
            e.message);
    }
}


/**
 * Returns a plugin that will parse the client's Authorization header.
 *
 * Subsequent handlers will see `req.authorization`, which looks like:
 *
 * {
 *   scheme: <Basic|Signature|...>,
 *   credentials: <Undecoded value of header>,
 *   basic: {
 *     username: $user
 *     password: $password
 *   }
 * }
 *
 * `req.username` will also be set, and defaults to 'anonymous'.
 *
 * @public
 * @function authorizationParser
 * @throws   {InvalidArgumentError}
 * @param    {Object} options an options object
 * @returns  {Function}
 */
function authorizationParser(options) {

    function parseAuthorization(req, res, next) {
        req.authorization = {};
        req.username = 'anonymous';

        if (!req.headers.authorization) {
            return (next());
        }

        var pieces = req.headers.authorization.split(' ', 2);

        if (!pieces || pieces.length !== 2) {
            var e = new InvalidHeaderError('BasicAuth content ' +
                'is invalid.');
            return (next(e));
        }

        req.authorization.scheme = pieces[0];
        req.authorization.credentials = pieces[1];

        try {
            switch (pieces[0].toLowerCase()) {
                case 'basic':
                    req.authorization.basic = parseBasic(pieces[1]);
                    req.username = req.authorization.basic.username;
                    break;

                case 'signature':
                    req.authorization.signature =
                        parseSignature(req, options);
                    req.username =
                        req.authorization.signature.keyId;
                    break;

                default:
                    break;
            }
        } catch (e2) {
            return (next(e2));
        }

        return (next());
    }

    return (parseAuthorization);
}

module.exports = authorizationParser;
