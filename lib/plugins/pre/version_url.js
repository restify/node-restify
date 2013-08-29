var semver = require('semver'),
    url    = require('url');

var fs = require('fs');

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

                        if (override || !(req.headers['accept-version'] || req.headers['x-api-version'])) {
                                req.headers['accept-version'] = version;

                                uri = req.getUrl();
                                uri.pathname = '/' + pathSegments.slice(2).join('/');

                                req.url = url.format(uri);
                                req._url = undefined;
                                req._path = undefined;
                        }
                }

                next();
        }

        return (_versionUrl);
}

module.exports = versionUrl;

/* vim: set ts=8 sw=8: */
