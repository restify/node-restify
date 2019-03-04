'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var http = require('http');

var _ = require('lodash');
var assert = require('assert-plus');
var errors = require('restify-errors');
var uuid = require('uuid');

var Chain = require('./chain');
var RouterRegistryRadix = require('./routerRegistryRadix');

///--- Globals

var MethodNotAllowedError = errors.MethodNotAllowedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;

///--- API

/**
 * Router class handles mapping of http verbs and a regexp path,
 * to an array of handler functions.
 *
 * @class
 * @public
 * @param  {Object} options - an options object
 * @param  {Bunyan} options.log - Bunyan logger instance
 * @param {Boolean} [options.onceNext=false] - Prevents calling next multiple
 *  times
 * @param {Boolean} [options.strictNext=false] - Throws error when next() is
 *  called more than once, enabled onceNext option
 * @param {Object} [options.registry] - route registry
 * @param {Boolean} [options.ignoreTrailingSlash=false] - ignore trailing slash
 * on paths
 */
function Router(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');
    assert.optionalBool(options.onceNext, 'options.onceNext');
    assert.optionalBool(options.strictNext, 'options.strictNext');
    assert.optionalBool(
        options.ignoreTrailingSlash,
        'options.ignoreTrailingSlash'
    );

    EventEmitter.call(this);

    this.log = options.log;
    this.onceNext = !!options.onceNext;
    this.strictNext = !!options.strictNext;
    this.name = 'RestifyRouter';

    // Internals
    this._anonymousHandlerCounter = 0;
    this._registry = options.registry || new RouterRegistryRadix(options);
}
util.inherits(Router, EventEmitter);

/**
 * Lookup for route
 *
 * @public
 * @memberof Router
 * @instance
 * @function lookup
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @returns {Chain|undefined} handler or undefined
 */
Router.prototype.lookup = function lookup(req, res) {
    var pathname = req.getUrl().pathname;

    // Find route
    var registryRoute = this._registry.lookup(req.method, pathname);

    // Not found
    if (!registryRoute) {
        return undefined;
    }

    // Decorate req
    req.params = Object.assign(req.params, registryRoute.params);
    req.route = registryRoute.route;

    // Call handler chain
    return registryRoute.handler;
};

/**
 * Lookup by name
 *
 * @public
 * @memberof Router
 * @instance
 * @function lookupByName
 * @param {String} name - route name
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @returns {Chain|undefined} handler or undefined
 */
Router.prototype.lookupByName = function lookupByName(name, req, res) {
    var self = this;
    var route = self._registry.get()[name];

    if (!route) {
        return undefined;
    }

    // Decorate req
    req.route = route;

    return route.chain.run.bind(route.chain);
};

/**
 * Takes an object of route params and query params, and 'renders' a URL.
 *
 * @public
 * @function render
 * @param    {String} routeName - the route name
 * @param    {Object} params -    an object of route params
 * @param    {Object} query -     an object of query params
 * @returns  {String} URL
 * @example
 * server.get({
 *      name: 'cities',
 *      path: '/countries/:name/states/:state/cities'
 * }, (req, res, next) => ...));
 * let cities = server.router.render('cities', {
 *      name: 'Australia',
 *      state: 'New South Wales'
 * });
 * // cities:  '/countries/Australia/states/New%20South%20Wales/cities'
 */
Router.prototype.render = function render(routeName, params, query) {
    var self = this;

    function pathItem(match, key) {
        if (params.hasOwnProperty(key) === false) {
            throw new Error(
                'Route <' + routeName + '> is missing parameter <' + key + '>'
            );
        }
        return '/' + encodeURIComponent(params[key]);
    }

    function queryItem(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(query[key]);
    }

    var route = self._registry.get()[routeName];

    if (!route) {
        return null;
    }

    var _path = route.spec.path;
    var _url = _path.replace(/\/:([A-Za-z0-9_]+)(\([^\\]+?\))?/g, pathItem);
    var items = Object.keys(query || {}).map(queryItem);
    var queryString = items.length > 0 ? '?' + items.join('&') : '';
    return _url + queryString;
};

/**
 * Adds a route.
 *
 * @public
 * @memberof Router
 * @instance
 * @function mount
 * @param    {Object} opts - an options object
 * @param    {String} opts.name - name
 * @param    {String} opts.method - method
 * @param    {String} opts.path - path can be any String
 * @param    {Function[]} handlers - handlers
 * @returns  {String} returns the route name if creation is successful.
 * @fires ...String#mount
 */
Router.prototype.mount = function mount(opts, handlers) {
    var self = this;

    assert.object(opts, 'opts');
    assert.string(opts.method, 'opts.method');
    assert.arrayOfFunc(handlers, 'handlers');
    assert.optionalString(opts.name, 'opts.name');

    var chain = new Chain({
        onceNext: self.onceNext,
        strictNext: self.strictNext
    });

    // Route
    var route = {
        name: self._getRouteName(opts.name, opts.method, opts.path),
        method: opts.method,
        path: opts.path,
        spec: opts,
        chain: chain
    };

    handlers.forEach(function forEach(handler) {
        // Assign name to anonymous functions
        handler._name =
            handler.name || 'handler-' + self._anonymousHandlerCounter++;

        // Attach to middleware chain
        chain.add(handler);
    });

    self._registry.add(route);
    self.emit('mount', route.method, route.path);

    return route;
};

/**
 * Unmounts a route.
 *
 * @public
 * @memberof Router
 * @instance
 * @function unmount
 * @param    {String} name - the route name
 * @returns  {Object|undefined} removed route if found
 */
Router.prototype.unmount = function unmount(name) {
    assert.string(name, 'name');

    var route = this._registry.remove(name);
    return route;
};

/**
 * toString() serialization.
 *
 * @public
 * @memberof Router
 * @instance
 * @function toString
 * @returns  {String} stringified router
 */
Router.prototype.toString = function toString() {
    return this._registry.toString();
};

/**
 * Return information about the routes registered in the router.
 *
 * @public
 * @memberof Router
 * @instance
 * @returns {object} The routes in the router.
 */
Router.prototype.getDebugInfo = function getDebugInfo() {
    var routes = this._registry.get();
    return _.mapValues(routes, function mapValues(route, routeName) {
        return {
            name: route.name,
            method: route.method.toLowerCase(),
            path: route.path,
            handlers: route.chain.getHandlers()
        };
    });
};

/**
 * Return mounted routes
 *
 * @public
 * @memberof Router
 * @instance
 * @returns {object} The routes in the router.
 */
Router.prototype.getRoutes = function getRoutes() {
    return this._registry.get();
};

/**
 * Returns true if the router generated a 404 for an options request.
 *
 * TODO: this is relevant for CORS only. Should move this out eventually to a
 * userland middleware? This also seems a little like overreach, as there is no
 * option to opt out of this behavior today.
 *
 * @private
 * @static
 * @function _optionsError
 * @param    {Object}     req - the request object
 * @param    {Object}     res - the response object
 * @returns  {Boolean} is options error
 */
Router._optionsError = function _optionsError(req, res) {
    var pathname = req.getUrl().pathname;
    return req.method === 'OPTIONS' && pathname === '*';
};

/**
 * Default route, when no route found
 * Responds with a ResourceNotFoundError error.
 *
 * @private
 * @memberof Router
 * @instance
 * @function defaultRoute
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @param  {Function} next - next
 * @returns {undefined} no return value
 */
Router.prototype.defaultRoute = function defaultRoute(req, res, next) {
    var self = this;
    var pathname = req.getUrl().pathname;

    // Allow CORS
    if (Router._optionsError(req, res, pathname)) {
        res.send(200);
        next(null, req, res);
        return;
    }

    // Check for 405 instead of 404
    var allowedMethods = http.METHODS.filter(function some(method) {
        return method !== req.method && self._registry.lookup(method, pathname);
    });

    if (allowedMethods.length) {
        res.methods = allowedMethods;
        res.setHeader('Allow', allowedMethods.join(', '));
        var methodErr = new MethodNotAllowedError(
            '%s is not allowed',
            req.method
        );
        next(methodErr, req, res);
        return;
    }

    // clean up the url in case of potential xss
    // https://github.com/restify/node-restify/issues/1018
    var err = new ResourceNotFoundError('%s does not exist', pathname);
    next(err, req, res);
};

/**
 * Generate route name
 *
 * @private
 * @memberof Router
 * @instance
 * @function _getRouteName
 * @param    {String|undefined} name - Name of the route
 * @param    {String} method - HTTP method
 * @param    {String} path - path
 * @returns  {String} name of the route
 */
Router.prototype._getRouteName = function _getRouteName(name, method, path) {
    // Generate name
    if (!name) {
        name = method + '-' + path;
        name = name.replace(/\W/g, '').toLowerCase();
    }

    // Avoid name conflict: GH-401
    if (this._registry.get()[name]) {
        name += uuid.v4().substr(0, 7);
    }

    return name;
};

module.exports = Router;
