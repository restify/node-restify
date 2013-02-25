// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var fs = require('fs');
var path = require('path');

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

        var p = path.normalize(opts.directory).replace(/\\/g, '/');
        var re = new RegExp('^' + p + '/?.*');

        function serveFileFromStats(file, err, stats, req, res, next) {
                if (err) {
                        next(new ResourceNotFoundError(err,
                                                req.path()));
                        return;
                } else if (!stats.isFile()) {
                        next(new ResourceNotFoundError(req.path()));
                        return;
                }

                var fstream = fs.createReadStream(file);
                fstream.once('open', function (fd) {
                        res.cache({maxAge: opts.maxAge || 3600});
                        res.set('Content-Length', stats.size);
                        res.set('Content-Type', mime.lookup(file));
                        res.set('Last-Modified', stats.mtime);
                        res.writeHead(200);
                        fstream.pipe(res);
                        fstream.once('end', function () {
                                next(false);
                        });
                });
        }

        function serve(req, res, next) {
                var file = path.join(opts.directory, req.path());

                if (req.method !== 'GET' && req.method !== 'HEAD') {
                        next(new MethodNotAllowedError(req.method));
                        return;
                }

                if (!re.test(file.replace(/\\/g, '/'))) {
                        next(new NotAuthorizedError(req.path()));
                        return;
                }

                if (opts.match && !opts.match.test(file)) {
                        next(new NotAuthorizedError(req.path()));
                        return;
                }

                fs.stat(file, function (err, stats) {
                        if (!err && stats.isDirectory() && opts.default) {
                                // Serve an index.html page or similar
                                file = path.join(file, opts.default);
                                fs.stat(file, function (dirErr, dirStats) {
                                        serveFileFromStats(file,
                                                           dirErr,
                                                           dirStats,
                                                           req,
                                                           res,
                                                           next);
                                });
                        } else {
                                serveFileFromStats(file,
                                                   err,
                                                   stats,
                                                   req,
                                                   res,
                                                   next);
                        }
                });
        }

        return (serve);
}

module.exports = serveStatic;
