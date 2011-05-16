restify-log(3) -- The restify Logger
====================================

## SYNOPSIS

    var restify = require('restify');
    var log = restify.log;

    log.level(restify.LogLevel.Debug);

    if (log.debug()) {
      log.debug('Here's an object: %o', { foo: 'bar' });
    }

## DESCRIPTION

The restify logger is a minimal log4j-esque logger that restify uses
internally, and is generally useful for most projects.  It logs a standard
formatted message to `stderr`, and prefixes like:

    YYYY-MM-DD HH:MM:SSZ <LEVEL>: sprintf formatted message here.

Level is one of the following, in descending order:

* Fatal
* Error
* Warn
* Info
* Debug
* Trace

Descending means if you set the level to say 'Warn', then the logger will only
output messages that are of level Fatal/Error/Warn.  Everything else will be
surpressed.  The default level is Info.

Each level is accessed by a lower-case method of the same name:

* log.fatal()
* log.error()
* log.warn()
* log.info()
* log.debug()
* log.trace()

These methods take an `sprintf` style message, where the following format
qualifiers are supported:

* %d Number
* %s String
* %o Object (uses node.js util.inspect())

You can check for a level being enabled in your code by calling these functions
with no arguments:

    if (log.debug()) {
       // Some expensive calculation
       log.debug('Here's %s object: %o', 'foo', {});
    }

The restify framework uses Fatal/Error/Warn/Info/Trace.  To get verbose internal
logging from restify, set the level to Trace.  Debug is intended to be used by
applications as a useful way to generate debug logs.

Finally, set the level with `log.level`.  The level params are on the:
`restify.LogLevel` object.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3)
