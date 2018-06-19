'use strict';

var errors = require('restify-errors');

module.exports = {
    RequestCloseError: errors.makeConstructor('RequestCloseError'),
    RouteMissingError: errors.makeConstructor('RouteMissingError')
};
