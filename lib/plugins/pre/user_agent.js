// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');


///--- API

/**
 * This basically exists for curl.  curl on HEAD requests usually
 * just sits there and hangs, unless you explicitly set
 * Connection:close.  And in general, you probably want to set
 * Connection: close to curl anyway.
 *
 * Also, because curl spits out an annoying message to stderr about
 * remaining bytes if content-length is set, this plugin also drops
 * the content-length header (some user agents handle it and want it,
 * curl does not).
 *
 * To be slightly more generic, the options block takes a user
 * agent regexp, however.
 * @public
 * @function userAgentConnection
 * @param    {Object}   opts an options object
 * @returns  {Function}
 */
function userAgentConnection(opts) {
    assert.optionalObject(opts, 'options');
    opts = opts || {};
    assert.optionalObject(opts.userAgentRegExp, 'options.userAgentRegExp');

    var re = opts.userAgentRegExp;

    if (!re) {
        re = /^curl.+/;
    }

    function handleUserAgent(req, res, next) {
        var ua = req.headers['user-agent'];

        if (ua && re.test(ua)) {
            res.setHeader('Connection', 'close');
        }

        if (req.method === 'HEAD') {
            res.once('header',
                res.removeHeader.bind(res, 'content-length'));
        }

        next();
    }

    return (handleUserAgent);
}

module.exports = userAgentConnection;
