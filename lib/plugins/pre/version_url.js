var semver = require('semver'),
    url    = require('url');

var fs = require('fs');

function hasVer(req) {
        return req.headers.hasOwnProperty('accept-version') ||
               req.headers.hasOwnProperty('x-api-version');
}

function versionUrl(override) {
        function _versionUrl(req, res, next) {
                var pathSegments = req.getPath().split('/'),
                    version,
                    uri;

                if ((pathSegments.length > 2) && (pathSegments[1].charAt(0) === 'v')) {
                        version = '~' + pathSegments[1].replace('v', '');

                        if (!semver.validRange(version)) {
                                next();
                                return;
                        }

                        uri = req.getUrl();
                        uri.pathname = '/' + pathSegments.slice(2).join('/');

                        req.url = url.format(uri);
                        req._url = undefined;
                        req._path = undefined;

                        if (!hasVer(req) || override) {
                                req.headers['accept-version'] = version;
                        }
                }

                next();
        }

        return (_versionUrl);
}

module.exports = versionUrl;

/* vim: set ts=8 sw=8: */
