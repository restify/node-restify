'use strict';

var errors = require('restify-errors');

// This allows Restify to work with restify-errors v6+
module.exports = {
    RequestCloseError: errors.makeConstructor('RequestCloseError'),
    RouteMissingError: errors.makeConstructor('RouteMissingError')
};
