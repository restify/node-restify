// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var util = require('util');

var sprintf = require('./sprintf').sprintf;

function _pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}

function _format(level, args) {
  var d = new Date();
  var _args = [null,
               d.getUTCFullYear(),
               _pad(d.getUTCMonth()),
               _pad(d.getUTCDate()),
               _pad(d.getUTCHours()),
               _pad(d.getUTCMinutes()),
               _pad(d.getUTCSeconds()),
               level
              ];

  var _fmt = '%d-%s-%s %s:%s:%sZ %s: ';
  if (args.length > 1) {
    _args[0] = _fmt + args[0];
    for (var i = 1; i < args.length; i++) {
      _args.push(args[i]);
    }
  } else {
    _args[0] = _fmt + '%s';
    _args.push(args[0]);
  }

  return sprintf.apply(null, _args);
}

var Level = {
  Trace: 6,
  Debug: 5,
  Info: 4,
  Warn: 3,
  Error: 2,
  Fatal: 1
};

var _level = Level.Info;
module.exports = {

  trace: function() {
    if (arguments.length === 0) return _level >= Level.Trace;
    if (_level >= Level.Trace) console.error(_format('TRACE', arguments));
  },

  debug: function() {
    if (arguments.length === 0) return _level >= Level.Debug;
    if (_level >= Level.Debug) console.error(_format('DEBUG', arguments));
  },

  info: function() {
    if (arguments.length === 0) return _level >= Level.Info;
    if (_level >= Level.Info) console.error(_format('INFO', arguments));
  },

  warn: function() {
    if (arguments.length === 0) return _level >= Level.Warn;
    if (_level >= Level.Warn) console.error(_format('WARN', arguments));
  },

  error: function() {
    if (arguments.length === 0) return _level >= Level.Error;
    if (_level >= Level.Error) console.error(_format('ERROR', arguments));
  },

  fatal: function() {
    if (arguments.length === 0) return _level >= Level.Fatal;
    if (_level >= Level.Fatal) console.error(_format('FATAL', arguments));
  },

  level: function(level) {
    if (level && typeof(level) === typeof(Level.Debug)) {
      _level = level;
    }
    return _level;
  },

  Level: Level

};
