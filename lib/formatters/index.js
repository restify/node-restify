// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var fs = require('fs');
var path = require('path');


///--- Helpers

function exportFormatter(file) {
        if (!/.+\.js$/.test(file))
                return (false);

        var formatter = require('./' + path.basename(file, '.js'));
        Object.keys(formatter).forEach(function (k) {
                if (formatter[k].name)
                        module.exports[k] = formatter[k];
        });

        return (true);
}



///--- Exports

module.exports = {};

// Just load up all the JS in this directory and export it.
fs.readdirSync(__dirname).forEach(function (file) {
        return (exportFormatter(file));
});
