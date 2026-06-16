// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

/**
 * Return a shallow copy of the given object;
 *
 * @public
 * @function  shallowCopy
 * @param   {Object} obj - the object to copy
 * @returns {Object}     the new copy of the object
 */
function shallowCopy(obj) {
    if (!obj) {
        return obj;
    }
    var copy = {};
    Object.keys(obj).forEach(function forEach(k) {
        copy[k] = obj[k];
    });
    return copy;
}

/**
 * Merges two query parameter objects. Merges to array
 * if the same key is encountered.
 *
 * @public
 * @function  mergeQs
 * @param   {Object} obj1 - first qs object
 * @param   {Object} obj2 - second qs object
 * @returns {Object}        the merged object
 */
function mergeQs(obj1, obj2) {
    var merged = shallowCopy(obj1) || {};

    // defend against null cause null is an object. yay js.
    if (obj2 && typeof obj2 === 'object') {
        Object.keys(obj2).forEach(function forEach(key) {
            // if we already have this key and it isn't an array,
            // make it one array of the same element.
            if (merged.hasOwnProperty(key) && !(merged[key] instanceof Array)) {
                merged[key] = [merged[key]];

                // push the new value down
                merged[key].push(obj2[key]);
            } else {
                // otherwise just set it
                merged[key] = obj2[key];
            }
        });
    }

    return merged;
}

/**
 * Converts a URLSearchParams instance into a plain object,
 * accumulating duplicate keys into arrays (mirrors url.parse behavior).
 *
 * @public
 * @function parseUrlQuery
 * @param   {URLSearchParams} searchParams - URLSearchParams instance from a parsed URL
 * @returns {Object} plain object with string or string-array values
 */
function parseUrlQuery(searchParams) {
    var query = {};
    searchParams.forEach(function forEach(v, k) {
        if (query.hasOwnProperty(k)) {
            query[k] = [].concat(query[k], v);
        } else {
            query[k] = v;
        }
    });
    return query;
}

/**
 * Formats a URI descriptor object into a URL string,
 * replacing url.format(). Handles array query values as repeated params.
 *
 * @public
 * @function formatUrl
 * @param   {String|Object} uri - a string or {protocol, hostname, port, pathname, query}
 * @returns {String} formatted URL string
 */
function formatUrl(uri) {
    if (typeof uri === 'string') {
        return uri;
    }

    var loc = '';
    if (uri.hostname) {
        loc =
            (uri.protocol || 'http') +
            '://' +
            uri.hostname +
            (uri.port ? ':' + uri.port : '');
    }

    var pathname = uri.pathname || '/';
    loc += pathname[0] === '/' ? pathname : '/' + pathname;

    if (uri.query && Object.keys(uri.query).length > 0) {
        var params = new URLSearchParams();
        Object.keys(uri.query).forEach(function forEach(k) {
            var v = uri.query[k];
            if (Array.isArray(v)) {
                v.forEach(function forEachItem(item) {
                    params.append(k, item);
                });
            } else {
                params.set(k, v);
            }
        });
        loc += '?' + params.toString();
    }

    return loc;
}

/**
 * Parses a raw HTTP request URL string into a legacy url.parse-shaped object.
 * Handles the special OPTIONS '*' request-target.
 *
 * @public
 * @function parseRequestUrl
 * @param   {String} rawUrl - the raw request URL string
 * @returns {Object} url descriptor with pathname, search, query, href etc.
 */
function parseRequestUrl(rawUrl) {
    var pathname, search, hash, port, hostname;

    if (rawUrl === '*') {
        pathname = '*';
        search = null;
        hash = null;
        port = null;
        hostname = null;
    } else if (rawUrl.indexOf('://') !== -1) {
        var absParsed = new URL(rawUrl);
        pathname = absParsed.pathname;
        search = absParsed.search || null;
        hash = absParsed.hash || null;
        port = absParsed.port || null;
        hostname = absParsed.hostname || null;
    } else {
        var relParsed = new URL(rawUrl, 'http://localhost');
        pathname = relParsed.pathname;
        search = relParsed.search || null;
        hash = relParsed.hash || null;
        port = null;
        hostname = null;
    }

    return {
        protocol: null,
        slashes: null,
        auth: null,
        host: null,
        port: port,
        hostname: hostname,
        hash: hash,
        search: search,
        query: search ? search.slice(1) : null,
        pathname: pathname,
        path: pathname + (search || ''),
        href: rawUrl
    };
}

///--- Exports

module.exports = {
    shallowCopy: shallowCopy,
    mergeQs: mergeQs,
    parseUrlQuery: parseUrlQuery,
    formatUrl: formatUrl,
    parseRequestUrl: parseRequestUrl
};
