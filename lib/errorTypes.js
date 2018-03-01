'use strict';

var errors = require('restify-errors');

function defineError(name) {
    errors[name] = errors.makeConstructor(name);
}

['RequestCloseError', 'RequestAbortedError'].forEach(defineError);
