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

        var re = new RegExp('^' + path.normalize(opts.directory) + '/?.*');

        function serve(req, res, next) {
                var file = path.normalize(opts.directory + req.path());

                if (req.method !== 'GET' && req.method !== 'HEAD') {
                        next(new MethodNotAllowedError(req.method));
                        return;
                }

                if (!re.test(file)) {
                        next(new NotAuthorizedError(req.path()));
                        return;
                }

                if (opts.match && !opts.match.test(file)) {
                        next(new NotAuthorizedError(req.path()));
                        return;
                }

                fs.stat(file, function (err, stats) {
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
                        });

                        fstream.pipe(res);
                        fstream.once('end', function () {
                                next(false);
                        });
                });
        }

        return (serve);
}

module.exports = serveStatic;
