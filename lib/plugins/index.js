// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var fs = require('fs');
var path = require('path');



///--- Exports

module.exports = {};

// Just load up all the JS in this directory and export it.
fs.readdirSync(__dirname).forEach(function(file) {
  if (!/.+\.js$/.test(file))
    return;

  var plugin = require('./' + path.basename(file, '.js'));
  module.exports[plugin.name] = plugin;
});
