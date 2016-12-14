'use strict';

var errors = require('restify-errors');

errors.makeConstructor('RequestCloseError');
errors.makeConstructor('RequestAbortedError');
