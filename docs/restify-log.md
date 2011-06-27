restify-log(7) -- The restify Logger
====================================

## SYNOPSIS

    var restify = require('restify');
    var log = restify.log;

    log.level('Debug');

    if (log.debug())
      log.debug('Here's an object: %o', { foo: 'bar' });


## DESCRIPTION

The restify logger is a minimal log4j-esque logger that restify uses
internally, and is generally useful for most projects.  It logs a standard
formatted message to `stderr`, and prefixes like:

    YYYY-MM-DD HH:MM:SSZ <LEVEL>: sprintf formatted message here.

Level is one of the following, in descending order:

* Off
* Fatal
* Error
* Warn
* Info
* Debug
* Trace

Descending means if you set the level to say 'Warn', then the logger will only
output messages that are of level Fatal/Error/Warn.  Everything else will be
surpressed.  The default level is Info.  Off disables logging altogether.

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
* %o Object

You can check for a level being enabled in your code by calling these functions
with no arguments:

    if (log.debug()) {
       // Some expensive calculation
       log.debug('Here's %s object: %o', 'foo', {});
    }

The restify framework uses Fatal/Error/Warn/Info/Trace.  To get verbose internal
logging from restify, set the level to Trace.  Debug is intended to be used by
applications as a useful way to generate debug logs.

Finally, set the level with `log.level`.  The level params are on the
`restify.LogLevel` object; you can pass either the enum value or a string.

## W3C LOGGING

In addition to the "human" output functions above, the log also ships with a W3C
compliant interceptor that you can use anywhere after `response.send` has been
invoked.  W3C log messages are basically this:

    127.0.0.1 - admin [12/05/2011:18:31:49 GMT] "GET /foo/bar HTTP/1.1" 200 79 58

Where you have (in order) IP, username, timestamp, the HTTP request-line,
response code, bytes sent, and the time (ms) it took to respond.  The response
time is not technically part of the W3C specification, but a lot of HTTP servers
do it, and it's useful, so restify does it.  The user above comes from
`req.username`, which automatically gets set if you're using HTTP Basic
Authentication.  If your clients are not authenticating with that, you will have
to set it in somewhere before the logger gets invoked.  Otherwise you'll just
get a '-' character in it's place (which is what the spec says to do).

To use this logger, just add `log.w3c` to your request chain (somewhere after a
handler that will have called `response.send`.

## OUTPUT REDIRECTION

By default, `log.w3c` writes to stdout, and the debug/info/... functions write
to `stderr`.  To redirect these, pass a node.js `WriteableStream` into the
functions `log.stdout` and `log.stderr` respectively.  For example, you could
write a `WriteableStream` that is actually a rolling file appender.  That'd be
cool...

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3)
