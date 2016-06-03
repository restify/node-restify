'use strict';


function deprecationWarnings(server) {

    // deprecation for domains and next.ifError
    if (server.handleUncaughtExceptions === true) {
        server.log.warn([
            'DEPRECATION WARNING: Due to deprecation of the domain module',
            'in node.js, all features in restify that depend on it have been',
            'deprecated as well. This includes `handleUncaughtExceptions` and',
            '`next.ifError()`. They will continue to work in 5.x, but',
            'consider them unsupported and likely to be removed from future',
            'versions of restify.'
        ].join(' '));
    }
}


module.exports = deprecationWarnings;
