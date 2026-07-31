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

///--- Exports

module.exports = {
    shallowCopy: shallowCopy,
    mergeQs: mergeQs
};
