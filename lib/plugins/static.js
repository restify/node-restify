// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var fs = require('fs');
var path = require('path');
var escapeRE = require('escape-regexp-component');

var assert = require('assert-plus');
var mime = require('mime');
var errors = require('restify-errors');

///--- Globals

var MethodNotAllowedError = errors.MethodNotAllowedError;
var NotAuthorizedError = errors.NotAuthorizedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;

///--- Functions

/**
 * Serves static files.
 *
 * @public
 * @function serveStatic
 * @param    {Object} options - an options object
 * @throws   {MethodNotAllowedError} |
 * @throws   {NotAuthorizedError}
 * @throws   {ResourceNotFoundError}
 * @returns  {Function} Handler
 * @example
 * <caption>
 * The serveStatic module is different than most of the other plugins, in that
 * it is expected that you are going to map it to a route, as below:
 * </caption>
 * server.get('/docs/current/*', restify.plugins.serveStatic({
 *   directory: './documentation/v1',
 *   default: 'index.html'
 * }));
 * @example
 * <caption>
 * The above `route` and `directory` combination will serve a file located in
 * `./documentation/v1/docs/current/index.html` when you attempt to hit
 * `http://localhost:8080/docs/current/`. If you want the serveStatic module to
 * serve files directly from the `/documentation/v1` directory
 * (and not append the request path `/docs/current/`),
 * you can set the `appendRequestPath` option to `false`, and the served file
 * would be `./documentation/v1/index.html`, in the previous example.
 *
 * The plugin will enforce that all files under `directory` are served.
 * The `directory` served is relative to the process working directory.
 * You can also provide a `default` parameter such as index.html for any
 * directory that lacks a direct file match.
 * You can specify additional restrictions by passing in a `match` parameter,
 * which is just a `RegExp` to check against the requested file name.
 * Additionally, you may set the `charSet` parameter, which will append a
 * character set to the content-type detected by the plugin.
 * For example, `charSet: 'utf-8'` will result in HTML being served with a
 * `Content-Type` of `text/html; charset=utf-8`.
 * Lastly, you can pass in a `maxAge` numeric, which will set the
 * `Cache-Control` header. Default is `3600` (1 hour).
 *
 * An additional option for serving a static file is to pass `file` in to the
 * serveStatic method as an option. The following will serve index.html from
 * the documentation/v1/ directory anytime a client requests `/home/`.
 * </caption>
 * server.get('/home/*', restify.plugins.serveStatic({
 *   directory: './documentation/v1',
 *   file: 'index.html'
 * }));
 * // or
 * server.get('/home/([a-z]+[.]html)', restify.plugins.serveStatic({
 *   directory: './documentation/v1',
 *   file: 'index.html'
 * }));
 */
function serveStatic(options) {
    var opts = options || {};

    if (typeof opts.appendRequestPath === 'undefined') {
        opts.appendRequestPath = true;
    }

    assert.object(opts, 'options');
    assert.string(opts.directory, 'options.directory');
    assert.optionalNumber(opts.maxAge, 'options.maxAge');
    assert.optionalObject(opts.match, 'options.match');
    assert.optionalString(opts.charSet, 'options.charSet');
    assert.optionalString(opts.file, 'options.file');
    assert.bool(opts.appendRequestPath, 'options.appendRequestPath');

    var p = path.normalize(opts.directory).replace(/\\/g, '/');
    var re = new RegExp('^' + escapeRE(p) + '/?.*');

    function serveFileFromStats(file, err, stats, isGzip, req, res, next) {
        if (typeof req.closed === 'function' && req.closed()) {
            next(false);
            return;
        }

        if (err) {
            next(new ResourceNotFoundError(err, '%s', req.path()));
            return;
        } else if (!stats.isFile()) {
            next(new ResourceNotFoundError('%s does not exist', req.path()));
            return;
        }

        if (res.handledGzip && isGzip) {
            res.handledGzip();
        }

        var fstream = fs.createReadStream(file + (isGzip ? '.gz' : ''));
        var maxAge = opts.maxAge === undefined ? 3600 : opts.maxAge;
        fstream.once('open', function onceOpen(fd) {
            res.cache({ maxAge: maxAge });
            res.set('Content-Length', stats.size);
            res.set('Content-Type', mime.getType(file));
            res.set('Last-Modified', stats.mtime);

            if (opts.charSet) {
                var type =
                    res.getHeader('Content-Type') + '; charset=' + opts.charSet;
                res.setHeader('Content-Type', type);
            }

            if (opts.etag) {
                res.set('ETag', opts.etag(stats, opts));
            }
            res.writeHead(200);
            fstream.pipe(res);
            fstream.once('close', function onceClose() {
                next(false);
            });
        });

        res.once('close', function onceClose() {
            fstream.close();
        });
    }

    function serveNormal(file, req, res, next) {
        fs.stat(file, function fileStat(err, stats) {
            if (!err && stats.isDirectory() && opts.default) {
                // Serve an index.html page or similar
                var filePath = path.join(file, opts.default);
                fs.stat(filePath, function dirStat(dirErr, dirStats) {
                    serveFileFromStats(
                        filePath,
                        dirErr,
                        dirStats,
                        false,
                        req,
                        res,
                        next
                    );
                });
            } else {
                serveFileFromStats(file, err, stats, false, req, res, next);
            }
        });
    }

    function serve(req, res, next) {
        var file;

        if (opts.file) {
            //serves a direct file
            file = path.join(opts.directory, decodeURIComponent(opts.file));
        } else if (opts.appendRequestPath) {
            file = path.join(opts.directory, decodeURIComponent(req.path()));
        } else {
            var dirBasename = path.basename(opts.directory);
            var reqpathBasename = path.basename(req.path());

            if (
                path.extname(req.path()) === '' &&
                dirBasename === reqpathBasename
            ) {
                file = opts.directory;
            } else {
                file = path.join(
                    opts.directory,
                    decodeURIComponent(path.basename(req.path()))
                );
            }
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            next(new MethodNotAllowedError('%s', req.method));
            return;
        }

        if (!re.test(file.replace(/\\/g, '/'))) {
            next(new NotAuthorizedError('%s', req.path()));
            return;
        }

        if (opts.match && !opts.match.test(file)) {
            next(new NotAuthorizedError('%s', req.path()));
            return;
        }

        if (opts.gzip && req.acceptsEncoding('gzip')) {
            fs.stat(file + '.gz', function stat(err, stats) {
                if (!err) {
                    res.setHeader('Content-Encoding', 'gzip');
                    serveFileFromStats(file, err, stats, true, req, res, next);
                } else {
                    serveNormal(file, req, res, next);
                }
            });
        } else {
            serveNormal(file, req, res, next);
        }
    }

    return serve;
}

module.exports = serveStatic;
