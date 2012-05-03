// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var errors = require('./errors');



///--- Globals

var InvalidArgumentError = errors.InvalidArgumentError;
var MissingParameterError = errors.MissingParameterError;



///--- Messages

var ARG_REQUIRED = '%s is required';
var ARRAY_TYPE_REQUIRED = '%s ([%s]) required';
var TYPE_REQUIRED = '%s is required';



///--- API

function assertArgument(name, type, arg) {
        if (arg === undefined)
                throw new MissingParameterError(ARG_REQUIRED, name);


        if (typeof (arg) !== type)
                throw new InvalidArgumentError(TYPE_REQUIRED, name, type);


        return (true);
}


function assertArray(name, type, arr) {
        var ok = true;

        if (!Array.isArray(arr))
                throw new InvalidArgumentError(ARRAY_TYPE_REQUIRED, name, type);

        for (var i = 0; i < arr.length; i++) {
                if (typeof (arr[i]) !== type) {
                        ok = false;
                        break;
                }
        }

        if (!ok)
                throw new InvalidArgumentError(ARRAY_TYPE_REQUIRED, name, type);

}


function assertBoolean(name, arg) {
        return assertArgument(name, 'boolean', arg);
}


function assertFunction(name, arg) {
        return assertArgument(name, 'function', arg);
}


function assertNumber(name, arg) {
        return assertArgument(name, 'number', arg);
}


function assertObject(name, arg) {
        return assertArgument(name, 'object', arg);
}


function assertString(name, arg) {
        return assertArgument(name, 'string', arg);
}



///--- Exports

module.exports = {

        assertArgument: assertArgument,
        assertArray: assertArray,
        assertBoolean: assertBoolean,
        assertFunction: assertFunction,
        assertNumber: assertNumber,
        assertObject: assertObject,
        assertString: assertString

};
