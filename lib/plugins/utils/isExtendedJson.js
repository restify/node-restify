// Copyright 2018 Ifiok Idiang.  All rights reserved.

'use strict';

/**
 * Return the stripped content type string if it is a valid JSON extended type
 *
 * @public
 * @function  validateExtendedJsonContentType
 * @param   {String} contentType - the content type string to validate
 * @returns {Boolean}       validity flag
 */
function validateExtendedJsonContentType(contentType) {
    var type = contentType.toLowerCase();
    // map any +json to application/json
    var jsonPatternMatcher = new RegExp('^application/[a-zA-Z.]+\\+json');
    return jsonPatternMatcher.test(type);
}

///--- Exports

module.exports = validateExtendedJsonContentType;
