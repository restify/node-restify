// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var fs = require('fs');
var path = require('path');

var assert = require('assert-plus');
var mime = require('mime');
var errors = require('restify-errors');

///--- Globals

var ForbiddenError = errors.ForbiddenError;
var MethodNotAllowedError = errors.MethodNotAllowedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;

///--- Functions

/**
 * Serves static files.
 *
 * @public
 * @function serveStatic
 * @param    {Object} options - an options object
 * @throws   {ForbiddenError}
 * @throws   {MethodNotAllowedError}
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
 * It is not matched against the request path.
 * It is matched against the normalized unix file path including the
 * `directory` option and depending on the other options.
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

    var docRoot = path.normalize(opts.directory).replaceAll('\\', '/');
    if (!docRoot.endsWith('/')) {
        docRoot += '/';
    }

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

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            next(new MethodNotAllowedError('%s', req.method));
            return;
        }

        if (opts.file) {
            //serves a direct unchecked file
            file = path.join(docRoot, opts.file);
        } else if (opts.appendRequestPath) {
            file = path.join(docRoot, decodeURIComponent(req.path()));
        } else {
            var dirBasename = path.basename(docRoot);
            var reqpathBasename = decodeURIComponent(path.basename(req.path()));

            if (
                path.extname(reqpathBasename) === '' &&
                dirBasename === reqpathBasename
            ) {
                file = docRoot;
            } else {
                file = path.join(docRoot, reqpathBasename);
            }
        }

        // SAFETY CHECKS
        var normalizedFile = path.normalize(file).replaceAll('\\', '/');
        if (!normalizedFile.startsWith(docRoot)) {
            next(new ForbiddenError('%s', req.path()));
            return;
        }

        if (opts.match && !opts.match.test(normalizedFile)) {
            next(new ForbiddenError('%s', req.path()));
            return;
        }

        if (opts.gzip && req.acceptsEncoding('gzip')) {
            fs.stat(normalizedFile + '.gz', function stat(err, stats) {
                if (!err) {
                    res.setHeader('Content-Encoding', 'gzip');
                    serveFileFromStats(
                        normalizedFile,
                        err,
                        stats,
                        true,
                        req,
                        res,
                        next
                    );
                } else {
                    serveNormal(normalizedFile, req, res, next);
                }
            });
        } else {
            serveNormal(normalizedFile, req, res, next);
        }
    }

    return serve;
}

module.exports = serveStatic;
