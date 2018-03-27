'use strict';

var assert = require('assert-plus');
var FindMyWay = require('find-my-way');
var Chain = require('./chain');

/**
 * Radix tree based router registry backed by `find-my-way`
 *
 * @class RouterRegistryRadix
 * @public
 * @param  {Object} options - an options object
 * @param {Object} [options.ignoreTrailingSlash] - ignore trailing slash on
 *  paths
 */
function RouterRegistryRadix(options) {
    this._findMyWay = new FindMyWay(options);
    this._routes = {};
}

/**
 * Adds a route.
 *
 * @public
 * @memberof Router
 * @instance
 * @function add
 * @param    {Object} route - an route object
 * @param    {String} route.name - name of the route
 * @param    {String} route.method - HTTP method
 * @param    {String} route.path - any String accepted by
 * [find-my-way](https://github.com/delvedor/find-my-way)
 * @param    {Chain} route.chain - Chain instance
 * @returns  {Boolean} true
 */
RouterRegistryRadix.prototype.add = function add(route) {
    assert.object(route, 'route');
    assert.string(route.method, 'route.method');
    assert.string(route.path, 'path');
    assert.ok(route.chain instanceof Chain, 'route.chain');

    this._findMyWay.on(
        route.method,
        route.path,
        function onRoute(req, res, next) {
            route.chain.run(req, res, next);
        },
        {
            route: route
        }
    );

    this._routes[route.name] = route;

    return route;
};

/**
 * Removes a route.
 *
 * @public
 * @memberof RouterRegistryRadix
 * @instance
 * @function remove
 * @param    {String} name - the route name
 * @returns  {Object|undefined} removed route if found
 */
RouterRegistryRadix.prototype.remove = function remove(name) {
    assert.string(name, 'name');

    // check for route
    var route = this._routes[name];
    if (!route) {
        return undefined;
    }

    // remove from registry
    this._findMyWay.off(route.method, route.path);
    delete this._routes[name];

    return route;
};

/**
 * Registry for route
 *
 * @public
 * @memberof RouterRegistryRadix
 * @instance
 * @function Registry
 * @param  {String} method - method
 * @param  {String} pathname - pathname
 * @returns {Chain|undefined} handler or undefined
 */
RouterRegistryRadix.prototype.lookup = function lookup(method, pathname) {
    assert.string(method, 'method');
    assert.string(pathname, 'pathname');

    var fmwRoute = this._findMyWay.find(method, pathname);

    // Not found
    if (!fmwRoute) {
        return undefined;
    }

    // Call handler chain
    return {
        route: fmwRoute.store.route,
        params: fmwRoute.params,
        handler: fmwRoute.handler
    };
};

/**
 * Get registry
 *
 * @public
 * @memberof RouterRegistryRadix
 * @instance
 * @function toString
 * @returns  {String} stringified RouterRegistryRadix
 */
RouterRegistryRadix.prototype.get = function get() {
    return this._routes;
};

/**
 * toString() serialization.
 *
 * @public
 * @memberof RouterRegistryRadix
 * @instance
 * @function toString
 * @returns  {String} stringified RouterRegistryRadix
 */
RouterRegistryRadix.prototype.toString = function toString() {
    return this._findMyWay.prettyPrint();
};

module.exports = RouterRegistryRadix;
