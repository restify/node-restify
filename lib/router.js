// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var EventEmitter = require('events').EventEmitter;
var url = require('url');
var util = require('util');

var assert = require('assert-plus');
var deepEqual = require('deep-equal');
var LRU = require('lru-cache');
var Negotiator = require('negotiator');
var semver = require('semver');

var cors = require('./plugins/cors');
var errors = require('./errors');
var utils = require('./utils');



///--- Globals

var DEF_CT = 'application/octet-stream';

var maxSatisfying = semver.maxSatisfying;

var BadRequestError = errors.BadRequestError;
var InternalError = errors.InternalError;
var InvalidArgumentError = errors.InvalidArgumentError;
var InvalidVersionError = errors.InvalidVersionError;
var MethodNotAllowedError = errors.MethodNotAllowedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;
var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;

var shallowCopy = utils.shallowCopy;



///--- Helpers

function createCachedRoute(o, path, version, route) {
        if (!o.hasOwnProperty(path))
                o[path] = {};

        if (!o[path].hasOwnProperty(version))
                o[path][version] = route;
}


function matchURL(re, req) {
        var i = 0;
        var result = re.exec(req.path());
        var params = {};

        if (!result)
                return (false);

        // This means the user original specified a regexp match, not a url
        // string like /:foo/:bar
        if (!re.restifyParams) {
                for (i = 1; i < result.length; i++)
                        params[(i - 1)] = result[i];

                return (params);
        }

        // This was a static string, like /foo
        if (re.restifyParams.length === 0)
                return (params);

        // This was the "normal" case, of /foo/:id
        re.restifyParams.forEach(function (p) {
                if (++i < result.length)
                        params[p] = decodeURIComponent(result[i]);
        });

        return (params);
}


function compileURL(options) {
        if (options.url instanceof RegExp)
                return (options.url);
        assert.string(options.url, 'url');

        var params = [];
        var pattern = '^';
        var re;
        var _url = url.parse(options.url).pathname;
        _url.split('/').forEach(function (frag) {
                if (frag.length <= 0)
                        return (false);

                pattern += '\\/+';
                if (frag.charAt(0) === ':') {
                        if (options.urlParamPattern) {
                                pattern += '(' + options.urlParamPattern + ')';
                        } else {
                                // Strictly adhere to RFC3986
                                pattern += '([a-zA-Z0-9-_~\\.%@]+)';
                        }
                        params.push(frag.slice(1));
                } else {
                        pattern += frag;
                }

                return (true);
        });

        if (pattern === '^')
                pattern += '\\/';
        pattern += '$';

        re = new RegExp(pattern, options.flags);
        re.restifyParams = params;

        return (re);
}



///--- API

function Router(options) {
        assert.object(options, 'options');
        assert.object(options.log, 'options.log');

        EventEmitter.call(this);

        this.cache = LRU({max: 100});
        this.contentType = options.contentType || [];
        if (!Array.isArray(this.contentType))
                this.contentType = [this.contentType];
        assert.arrayOfString(this.contentType, 'options.contentType');

        this.log = options.log;
        this.mounts = {};
        this.name = 'RestifyRouter';

        // A list of methods to routes
        this.routes = {
                DELETE: [],
                GET: [],
                HEAD: [],
                OPTIONS: [],
                PATCH: [],
                POST: [],
                PUT: []
        };

        // So we can retrun 405 vs 404, we maintain a reverse mapping of URLs
        // to method
        this.reverse = {};

        this.versions = options.versions || options.version || [];
        if (!Array.isArray(this.versions))
                this.versions = [this.versions];
        assert.arrayOfString(this.versions, 'options.versions');

        this.versions.forEach(function (v) {
                if (semver.valid(v))
                        return (true);

                throw new InvalidArgumentError('%s is not a valid semver', v);
        });
        this.versions.sort();

}
util.inherits(Router, EventEmitter);
module.exports = Router;


Router.prototype.mount = function mount(options) {
        assert.object(options, 'options');
        assert.string(options.method, 'options.method');
        assert.string(options.name, 'options.name');

        var exists;
        var name = options.name;
        var route;
        var routes = this.routes[options.method];
        var self = this;
        var type = options.contentType || self.contentType;
        var versions = options.versions || options.version || self.versions;

        if (type) {
                if (!Array.isArray(type))
                        type = [type];
                type.filter(function (t) {
                        return (t);
                }).sort().join();
        }

        if (versions) {
                if (!Array.isArray(versions))
                        versions = [versions];
                versions.sort();
        }

        exists = routes.some(function (r) {
                return (r.name === name);
        });
        if (exists)
                return (false);

        route = {
                name: name,
                method: options.method,
                path: compileURL({
                        url: options.path || options.url,
                        flags: options.flags,
                        urlParamPattern: options.urlParamPattern
                }),
                spec: options,
                types: type,
                versions: versions
        };
        routes.push(route);

        if (!this.reverse[route.path.source])
                this.reverse[route.path.source] = [];

        if (this.reverse[route.path.source].indexOf(route.method) === -1)
                this.reverse[route.path.source].push(route.method);

        this.mounts[route.name] = route;

        this.emit('mount',
                  route.method,
                  route.path,
                  route.types,
                  route.versions);

        return (route.name);
};


Router.prototype.unmount = function unmount(name) {
        var route = this.mounts[name];
        if (!route) {
                this.log.warn('router.unmount(%s): route does not exist', name);
                return (false);
        }

        var reverse = this.reverse[route.path.source];
        var routes = this.routes[route.method];
        this.routes[route.method] = routes.filter(function (r) {
                return (r.name !== route.name);
        });

        this.reverse[route.path.source] = reverse.filter(function (r) {
                return (r !== route.method);
        });

        if (this.reverse[route.path.source].length === 0)
                delete this.reverse[route.path.source];

        delete this.mounts[name];

        return (name);
};


Router.prototype.get = function get(name, req, cb) {
        var params;
        var route = false;
        var routes = this.routes[req.method] || [];

        for (var i = 0; i < routes.length; i++) {
                if (routes[i].name === name) {
                        route = routes[i];
                        try {
                                params = matchURL(route.path, req);
                        } catch (e) {}
                        break;
                }
        }

        if (route) {
                cb(null, route, params || {});
        } else {
                cb(new InternalError());
        }
};


Router.prototype.find = function find(req, res, callback) {
        var candidates = [];
        var ct = req.headers['content-type'] || DEF_CT;
        var cacheKey = req.method + req.url + req.version() + ct;
        var cacheVal;
        var neg;
        var params;
        var r;
        var reverse;
        var routes = this.routes[req.method] || [];
        var typed;
        var versioned;

        if ((cacheVal = this.cache.get(cacheKey))) {
                res.methods = cacheVal.methods.slice();
                callback(null, cacheVal, shallowCopy(cacheVal.params));
                return;
        }

        for (var i = 0; i < routes.length; i++) {
                try {
                        params = matchURL(routes[i].path, req);
                } catch (e) {
                        this.log.trace({err: e}, 'error parsing URL');
                        callback(new BadRequestError(e.message));
                        return;
                }

                if (params === false)
                        continue;

                reverse = this.reverse[routes[i].path.source];

                if (routes[i].types.length && req.isUpload()) {
                        candidates.push({
                                p: params,
                                r: routes[i]
                        });
                        typed = true;
                        continue;
                }

                // GH-283: we want to find the latest version for a given route,
                // not the first one.  However, if neither the client nor
                // server specified any version, we're done, because neither
                // cared
                if (routes[i].versions.length === 0 && req.version() === '*') {
                        r = routes[i];
                        break;
                }

                if (routes[i].versions.length > 0) {
                        candidates.push({
                                p: params,
                                r: routes[i]
                        });
                        versioned = true;
                }
        }

        if (!r) {
                // If upload and typed
                if (typed) {
                        /* JSSTYLED */
                        var _t = ct.split(/\s*,\s*/);
                        candidates = candidates.filter(function (c) {
                                neg = new Negotiator({
                                        headers: {
                                                accept: c.r.types.join(', ')
                                        }
                                });
                                var tmp = neg.preferredMediaType(_t);
                                return (tmp && tmp.length);
                        });

                        // Pick the first one in case not versioned
                        if (candidates.length) {
                                r = candidates[0].r;
                                params = candidates[0].p;
                        }
                }

                if (versioned) {
                        candidates.forEach(function (c) {
                                var k = c.r.versions;
                                var v = semver.maxSatisfying(k, req.version());

                                if (v) {
                                        if (!r ||
                                            r.versions.some(function (v2) {
                                                    return (semver.gt(v, v2));
                                            })) {
                                                r = c.r;
                                                params = c.p;
                                        }
                                }
                        });
                }
        }

        // In order, we check if the route exists, in which case, we're good.
        // Otherwise we look to see if ver was set to false; that would tell us
        // we indeed did find a matching route (method+url), but the version
        // field didn't line up, so we return bad version.  If no route and no
        // version, we now need to go walk the reverse map and look at whether
        // we should return 405 or 404.  If it was an OPTIONS request, we need
        // to handle this having been a preflight request.
        if (params && r) {
                cacheVal = {
                        methods: reverse,
                        name: r.name,
                        params: params,
                        spec: r.spec
                };
                this.cache.set(cacheKey, cacheVal);
                res.methods = reverse.slice();
                callback(null, cacheVal, shallowCopy(params));
                return;
        }

        if (typed) {
                callback(new UnsupportedMediaTypeError(ct));
                return;
        }
        if (versioned) {
                callback(new InvalidVersionError('%s is not supported by %s %s',
                                                 req.version() || '?',
                                                 req.method,
                                                 req.path()));
                return;
        }

        // This is a very generic preflight handler - it does
        // not handle requiring authentication, nor does it do
        // any special checking for extra user headers. The
        // user will need to defined their own .opts handler to
        // do that
        function preflight(methods) {
                var headers = req.headers['access-control-request-headers'];
                var method = req.headers['access-control-request-method'];
                var origin = req.headers['origin'];

                if (req.method !== 'OPTIONS' ||
                    !origin ||
                    !method ||
                    methods.indexOf(method) === -1) {
                        return (false);
                }
                // Last, check request-headers
                var ok = true;
                /* JSSTYLED */
                (headers || '').split(/\s*,\s*/).forEach(function (h) {
                        if (!h)
                                return;

                        h = h.toLowerCase();
                        ok = cors.ALLOW_HEADERS.indexOf(h) !== -1 && ok;
                });
                if (!ok)
                        return (false);

                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods',
                              methods.join(', '));
                res.setHeader('Access-Control-Allow-Headers',
                              cors.ALLOW_HEADERS.join(', '));
                res.setHeader('Access-Control-Max-Age', 3600);

                return (true);
        }

        // Check for 405 instead of 404
        var urls = Object.keys(this.reverse);
        for (i = 0; i < urls.length; i++) {
                if (matchURL(new RegExp(urls[i]), req)) {
                        res.methods = this.reverse[urls[i]].slice();
                        res.setHeader('Allow', res.methods.join(', '));
                        if (preflight(res.methods)) {
                                callback(null, { name: 'preflight' });
                                return;
                        }
                        var err = new MethodNotAllowedError('%s is not allowed',
                                                            req.method);
                        callback(err);
                        return;
                }
        }

        callback(new ResourceNotFoundError('%s does not exist', req.url));
};


Router.prototype.toString = function toString() {
        var self = this;
        var str = this.name + ':\n';

        Object.keys(this.routes).forEach(function (k) {
                var routes = self.routes[k].map(function (r) {
                        return (r.name);
                });

                str += '\t\t' + k + ': [' + routes.join(', ') + ']\n';
        });

        return (str);
};
