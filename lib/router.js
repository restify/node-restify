// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var EventEmitter = require('events').EventEmitter;
var url = require('url');
var util = require('util');

var LRU = require('lru-cache');
var Negotiator = require('negotiator');
var _ = require('lodash');
var assert = require('assert-plus');
var cloneRegexp = require('clone-regexp');
var errors = require('restify-errors');
var semver = require('semver');

var utils = require('./utils');


///--- Globals

var DEF_CT = 'application/octet-stream';

var BadRequestError = errors.BadRequestError;
var InternalError = errors.InternalError;
var InvalidArgumentError = errors.InvalidArgumentError;
var InvalidVersionError = errors.InvalidVersionError;
var MethodNotAllowedError = errors.MethodNotAllowedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;
var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;

var shallowCopy = utils.shallowCopy;


///--- Helpers


/**
 * given a request, try to match it against the regular expression to
 * get the route params.
 * i.e., /foo/:param1/:param2
 * @private
 * @function matchURL
 * @param    {String | RegExp} re   a string or regular expression
 * @param    {Object}          req  the request object
 * @returns  {Object}
 */
function matchURL(re, req) {
    var i = 0;
    var result = re.exec(req.path());
    var params = {};

    if (!result) {
        return (false);
    }

    // This means the user original specified a regexp match, not a url
    // string like /:foo/:bar
    if (!re.restifyParams) {
        for (i = 1; i < result.length; i++) {
            params[(i - 1)] = result[i];
        }

        return (params);
    }

    // This was a static string, like /foo
    if (re.restifyParams.length === 0) {
        return (params);
    }

    // This was the "normal" case, of /foo/:id
    re.restifyParams.forEach(function (p) {
        if (++i < result.length) {
            params[p] = decodeURIComponent(result[i]);
        }
    });

    return (params);
}


/**
 * called while installing routes. attempts to compile the passed in string
 * or regexp and register it.
 * @private
 * @function compileURL
 * @param    {Object} options an options object
 * @returns  {RegExp}
 */
function compileURL(options) {
    if (options.url instanceof RegExp) {
        return (options.url);
    }
    assert.string(options.url, 'url');

    var params = [];
    var pattern = '^';
    var re;
    var _url = url.parse(options.url).pathname;
    _url.split('/').forEach(function (frag) {
        if (frag.length <= 0) {
            return (false);
        }

        pattern += '\\/+';

        if (frag.charAt(0) === ':') {
            var label = frag;
            var index = frag.indexOf('(');
            var subexp;

            if (index === -1) {
                if (options.urlParamPattern) {
                    subexp = options.urlParamPattern;
                } else {
                    subexp = '[^/]*';
                }
            } else {
                label = frag.substring(0, index);
                subexp = frag.substring(index + 1, frag.length - 1);
            }
            pattern += '(' + subexp + ')';
            params.push(label.slice(1));
        } else {
            pattern += frag;
        }
        return (true);
    });

    if (options.strict
        && _url.slice(-1) === '/') {
        pattern += '\\/';
    }

    if (!options.strict) {
        pattern += '[\\/]*';
    }

    if (pattern === '^') {
        pattern += '\\/';
    }

    pattern += '$';

    re = new RegExp(pattern, options.flags);
    re.restifyParams = params;

    return (re);
}


///--- API

/**
 * Router class handles mapping of http verbs and a regexp path,
 * to an array of handler functions.
 * @class
 * @public
 * @param  {Object} options an options object
 */
function Router(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');

    EventEmitter.call(this);

    this.cache = LRU({max: 100});
    this.contentType = options.contentType || [];

    if (!Array.isArray(this.contentType)) {
        this.contentType = [this.contentType];
    }
    assert.arrayOfString(this.contentType, 'options.contentType');

    this.strict = Boolean(options.strictRouting);
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

    // So we can return 405 vs 404, we maintain a reverse mapping of URLs
    // to method
    this.reverse = {};

    this.versions = options.versions || options.version || [];

    if (!Array.isArray(this.versions)) {
        this.versions = [this.versions];
    }
    assert.arrayOfString(this.versions, 'options.versions');

    this.versions.forEach(function (v) {
        if (semver.valid(v)) {
            return (true);
        }

        throw new InvalidArgumentError('%s is not a valid semver', v);
    });
    this.versions.sort();

}
util.inherits(Router, EventEmitter);

module.exports = Router;

/**
 * takes an object of route params and query params, and 'renders' a URL.
 * @public
 * @function render
 * @param    {String} routeName the route name
 * @param    {Object} params    an object of route params
 * @param    {Object} query     an object of query params
 * @returns  {String}
 */
Router.prototype.render = function render(routeName, params, query) {
    function pathItem(match, key) {
        if (params.hasOwnProperty(key) === false) {
            throw new Error('Route <' + routeName +
                            '> is missing parameter <' +
                            key + '>');
        }
        return ('/' + encodeURIComponent(params[key]));
    }

    function queryItem(key) {
        return (encodeURIComponent(key) + '=' + encodeURIComponent(query[key]));
    }

    var route = this.mounts[routeName];

    if (!route) {
        return (null);
    }

    var _path = route.spec.path;
    var _url = _path.replace(/\/:([A-Za-z0-9_]+)(\([^\\]+?\))?/g, pathItem);
    var items = Object.keys(query || {}).map(queryItem);
    var queryString = items.length > 0 ? ('?' + items.join('&')) : '';
    return (_url + queryString);
};


/**
 * adds a route.
 * @public
 * @function mount
 * @param    {Object} options an options object
 * @returns  {String} returns the route name if creation is successful.
 */
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
        if (!Array.isArray(type)) {
            type = [type];
        }
        type.filter(function (t) {
            return (t);
        }).sort().join();
    }

    if (versions) {
        if (!Array.isArray(versions)) {
            versions = [versions];
        }
        versions.sort();
    }

    exists = routes.some(function (r) {
        return (r.name === name);
    });

    if (exists) {
        return (false);
    }

    route = {
        name: name,
        method: options.method,
        path: compileURL({
            url: options.path || options.url,
            flags: options.flags,
            urlParamPattern: options.urlParamPattern,
            strict: self.strict
        }),
        spec: options,
        types: type,
        versions: versions
    };
    routes.push(route);

    if (!this.reverse[route.path.source]) {
        this.reverse[route.path.source] = [];
    }

    if (this.reverse[route.path.source].indexOf(route.method) === -1) {
        this.reverse[route.path.source].push(route.method);
    }

    this.mounts[route.name] = route;

    this.emit('mount',
        route.method,
        route.path,
        route.types,
        route.versions);

    return (route.name);
};


/**
 * unmounts a route.
 * @public
 * @function unmount
 * @param    {String} name the route name
 * @returns  {String}      the name of the deleted route.
 */
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

    if (!this.findByPath(route.spec.path, { method: route.method })) {
        this.reverse[route.path.source] = reverse.filter(function (r) {
            return (r !== route.method);
        });

        if (this.reverse[route.path.source].length === 0) {
            delete this.reverse[route.path.source];
        }
    }

    delete this.mounts[name];

    var cache = this.cache;
    cache.dump().forEach(function (i) {
        if (i.v.name === name) {
            cache.del(i.k);
        }
    });

    return (name);
};


/**
 * get a route from the router.
 * @public
 * @function get
 * @param    {String}    name the name of the route to retrieve
 * @param    {Object}    req  the request object
 * @param    {Function}  cb   callback function
 * @returns  {undefined}
 */
Router.prototype.get = function get(name, req, cb) {
    var params;
    var route = false;
    var routes = this.routes[req.method] || [];

    for (var i = 0; i < routes.length; i++) {
        if (routes[i].name === name) {
            route = routes[i];

            try {
                params = matchURL(route.path, req);
            } catch (e) {
                // if we couldn't match the URL, log it out.
                console.log(e);
            }
            break;
        }
    }

    if (route) {
        cb(null, route, params || {});
    } else {
        cb(new InternalError('Route not found: ' + name));
    }
};


/**
 * find a route from inside the router, handles versioned routes.
 * @public
 * @function find
 * @param    {Object}   req      the request object
 * @param    {Object}   res      the response object
 * @param    {Function} callback callback function
 * @returns  {undefined}
 */
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
    var maxV;

    if ((cacheVal = this.cache.get(cacheKey))) {
        res.methods = cacheVal.methods.slice();
        req._matchedVersion = cacheVal.matchedVersion;
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

        if (params === false) {
            continue;
        }

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
                    if (!r || !maxV || semver.gt(v, maxV)) {
                        r = c.r;
                        params = c.p;
                        maxV = v;
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
    // we should return 405 or 404.
    if (params && r) {
        cacheVal = {
            methods: reverse,
            name: r.name,
            params: params,
            spec: r.spec
        };

        if (versioned) {
            req._matchedVersion = maxV;
            cacheVal.matchedVersion = maxV;
        }

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

    // Check for 405 instead of 404
    var j;
    var urls = Object.keys(this.reverse);

    for (j = 0; j < urls.length; j++) {
        if (matchURL(new RegExp(urls[j]), req)) {
            res.methods = this.reverse[urls[j]].slice();
            res.setHeader('Allow', res.methods.join(', '));

            var err = new MethodNotAllowedError('%s is not allowed',
                req.method);
            callback(err);
            return;
        }
    }

    // clean up the url in case of potential xss
    // https://github.com/restify/node-restify/issues/1018
    var cleanedUrl = url.parse(req.url).pathname;
    callback(new ResourceNotFoundError(
        '%s does not exist', cleanedUrl
    ));
};

/**
 * Find a route by path. Scans the route list for a route with the same RegEx.
 * i.e. /foo/:param1/:param2 would match an existing route with different
 * parameter names /foo/:id/:name since the compiled RegExs match.
 * @public
 * @function findByPath
 * @param    {String | RegExp}    path      a path to find a route for.
 * @param    {Object}             options   an options object
 * @returns  {Object}             returns the route if a match is found
 */
Router.prototype.findByPath = function findByPath(path, options) {
    assert.string(path, 'path');
    assert.object(options, 'options');
    assert.string(options.method, 'options.method');

    var route;
    var routes = this.routes[options.method] || [];
    var routeRegex = compileURL({
        url: path,
        flags: options.flags,
        urlParamPattern: options.urlParamPattern,
        strict: this.strict
    });

    for (var i = 0; i < routes.length; i++) {
        if (routeRegex.toString() === routes[i].path.toString()) {
            route = routes[i];
            break;
        }
    }
    return (route);
};


/**
 * toString() serialization.
 * @public
 * @function toString
 * @returns  {String}
 */
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


/**
 * Return information about the routes registered in the router.
 * @public
 * @returns {object} The routes in the router.
 */
Router.prototype.getDebugInfo = function getRoutes() {
    var self = this;
    var routeInfo = [];

    _.forOwn(self.mounts, function (value, routeName) {
        if (self.mounts.hasOwnProperty(routeName)) {
            var mountedRoute = self.mounts[routeName];
            var routeRegex = mountedRoute.path;

            routeInfo.push({
                name: mountedRoute.name,
                method: mountedRoute.method.toLowerCase(),
                input: mountedRoute.spec.path,
                compiledRegex: cloneRegexp(routeRegex),
                // any url params are saved on the regex object as a key/val
                // bucket.
                compiledUrlParams: (routeRegex.restifyParams &&
                    (Object.keys(routeRegex.restifyParams).length > 0)) ?
                shallowCopy(routeRegex.restifyParams) : null,
                versions: (mountedRoute.versions.length > 1) ?
                mountedRoute.versions : null
            });
        }
    });

    return routeInfo;
};
