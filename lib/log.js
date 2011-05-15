/* Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
 *
 * A (very) minimal log4j-like knockoff.
 *
 * Usage:
 *    var log = require('restify').log
 *    log.debug("some debug info: %o", myobj)   // sprintf string interpolation
 *    log.warn("I can't let you do that, %s.", dave)
 *
 * Output goes to stderr. Looks like this:
 *    2011-03-25 20:28:21Z DEBUG: some debug info: {'foo': 'bar'}
 *    2011-03-25 20:30:21Z WARN: I can't let you do that, Dave.
 *
 * Log levels are:
 *    trace     // access via `log.Level.Trace`
 *    debug
 *    info      // the default
 *    warn
 *    error
 *    fatal
 * Set the log level via:
 *    log.level(log.Level.Warn)
 *
 * The `log.debug()`, `log.info()`, et al functions double as the log4j
 * `isEnableFor`, `isDebugEnabled` functions when called without arguments.
 * So you can skip expensive computation that is only needed if at a
 * given log level:
 *    if (log.debug()) {
 *      // some expensive calculations to get
 *      some_debug_data = ...
 *      log.debug("debug data is: %o", some_debug_data)
 *    }
 */

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
