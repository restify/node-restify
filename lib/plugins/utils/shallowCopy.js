// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

/**
 * Return a shallow copy of the given object
 *
 * @public
 * @function  shallowCopy
 * @param   {Object} obj - the object to copy
 * @returns {Object}       the new copy of the object
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

///--- Exports

module.exports = shallowCopy;
