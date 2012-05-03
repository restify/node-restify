// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var fs = require('fs');
var path = require('path');



///--- Helpers

function exportPlugin(file, child) {
        if (!/.+\.js$/.test(file))
                return (false);

        var plugin = require('./' +
                             (child ? (child + '/') : '') +
                             path.basename(file, '.js'));

        if (!plugin || !plugin.name)
                return (false);

        if (child) {
                if (!module.exports[child])
                        module.exports[child] = {};

                module.exports[child][plugin.name] = plugin;
        } else {
                module.exports[plugin.name] = plugin;
        }

        return (true);
}



///--- Exports

module.exports = {};

// Just load up all the JS in this directory and export it.
fs.readdirSync(__dirname).forEach(function (file) {
        return (exportPlugin(file));
});

fs.readdirSync(__dirname + '/pre').forEach(function (file) {
        return (exportPlugin(file, 'pre'));
});
