// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var fs = require('fs');
var path = require('path');
var escapeRE = require('escape-regexp-component');

var assert = require('assert-plus');
var mime = require('mime');
var errors = require('../errors');


///--- Globals

var MethodNotAllowedError = errors.MethodNotAllowedError;
var NotAuthorizedError = errors.NotAuthorizedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;



///--- Functions

function serveStatic(opts) {
        opts = opts || {};
        assert.object(opts, 'options');
        assert.string(opts.directory, 'options.directory');
        assert.optionalNumber(opts.maxAge, 'options.maxAge');
        assert.optionalObject(opts.match, 'options.match');
        assert.optionalString(opts.charSet, 'options.charSet');

        var p = path.normalize(opts.directory).replace(/\\/g, '/');
        var re = new RegExp('^' + escapeRE(p) + '/?.*');

        function serveFileFromStats(file, err, stats, isGzip, req, res, next) {
                if (err) {
                        next(new ResourceNotFoundError(err,
                                                       req.path()));
                        return;
                } else if (!stats.isFile()) {
                        next(new ResourceNotFoundError(req.path()));
                        return;
                }

                if (res.handledGzip && isGzip) {
                        res.handledGzip();
                }

                var fstream = fs.createReadStream(file + (isGzip ? '.gz' : ''));
                var maxAge = opts.maxAge === undefined ? 3600 : opts.maxAge;
                fstream.once('open', function (fd) {
                        res.cache({maxAge: maxAge});
                        res.set('Content-Length', stats.size);
                        res.set('Content-Type', mime.lookup(file));
                        res.set('Last-Modified', stats.mtime);
                        if (opts.charSet) {
                                var type = res.getHeader('Content-Type') +
                                        '; charset=' + opts.charSet;
                                res.setHeader('Content-Type', type);
                        }
                        if (opts.etag) {
                                res.set('ETag', opts.etag(stats, opts));
                        }
                        res.writeHead(200);
                        fstream.pipe(res);
                        fstream.once('end', function () {
                                next(false);
                        });
                });
        }

        function serveNormal(file, req, res, next) {
                fs.stat(file, function (err, stats) {
                        if (!err && stats.isDirectory() && opts.default) {
                                // Serve an index.html page or similar
                                file = path.join(file, opts.default);
                                fs.stat(file, function (dirErr, dirStats) {
                                        serveFileFromStats(file,
                                                           dirErr,
                                                           dirStats,
                                                           false,
                                                           req,
                                                           res,
                                                           next);
                                });
                        } else {
                                serveFileFromStats(file,
                                                   err,
                                                   stats,
                                                   false,
                                                   req,
                                                   res,
                                                   next);
                        }
                });
        }

        function serve(req, res, next) {
                var file = decodeURIComponent(req.path());
                var route;
                var regex;
                var stats;

                if (opts.directory) {
                        route = req.route.path.toString();
                        route = route.substring(1, route.length-4);
                        route = route.replace(/\\\//g,'/');

                        if (opts.directory.slice(-1) != '/')
                                opts.directory += '/';

                        regex = new RegExp(route, 'g');
                        file = req.path().replace(regex, opts.directory);
                }

                if (req.method !== 'GET' && req.method !== 'HEAD') {
                        next(new MethodNotAllowedError(req.method));
                        return;
                }

                if (!re.test(file.replace(/\\/g, '/'))) {
                        if (opts['default'] &&
                            file.indexOf(opts['default']) < 0) {
                                if (file.slice(-1) == '/') {
                                        file = file.substring(0,
                                                              file.length - 1);
                                }
                                if (fs.existsSync(file)) {
                                        stats = fs.lstatSync(file);
                                        if (stats.isDirectory()) {
                                                if (fs.existsSync(file)) {
                                                        file = file + '/' +
                                                                opts['default'];
                                                }
                                        }
                                }
                        }
                        serveNormal(file, req, res, next);
                        return;
                }

                if (opts.match && !opts.match.test(file)) {
                        next(new NotAuthorizedError(req.path()));
                        return;
                }

                if (opts.gzip && req.acceptsEncoding('gzip')) {
                        fs.stat(file + '.gz', function (err, _stats) {
                                if (!err) {
                                        res.setHeader('Content-Encoding',
                                                      'gzip');
                                        serveFileFromStats(file,
                                                           err,
                                                           _stats,
                                                           true,
                                                           req,
                                                           res,
                                                           next);
                                } else {
                                        serveNormal(file, req, res, next);
                                }
                        });
                } else {
                        serveNormal(file, req, res, next);
                }

        }

        return (serve);
}

module.exports = serveStatic;
