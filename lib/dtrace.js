// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');


///--- API

function addProbes(dtrace, name) {
        assert.object(dtrace, 'dtrace');
        assert.string(name, 'name');

        var obj = {};

        // id, requestid, user, user-agent, content-type, content-length
        // md5, accept, url, path, isKeepAlive, version, isSecure, isChunked
        var pStart = dtrace.addProbe(name + '-start',
                                     'int',
                                     'char *',
                                     'char *',
                                     'char *',
                                     'char *',
                                     'int',
                                     'char *',
                                     'char *',
                                     'char *',
                                     'char *',
                                     'char *',
                                     'int',
                                     'char *',
                                     'int',
                                     'int');

        // id, requestid, statusCode, content-type, content-length,
        // content-md5, version
        var pDone = dtrace.addProbe(name + '-done',
                                    'int',
                                    'char *',
                                    'int',
                                    'char *',
                                    'int',
                                    'int',
                                    'char *');

        obj.start = function fireProbeStart(req) {
                pStart.fire(function probeStart() {
                        var details = [
                                req.connection.fd,
                                req.id(),
                                (req.username || null),
                                (req.userAgent() || null),
                                (req.contentType() || null),
                                (req.contentLength() || 0),
                                (req.contentType() || null),
                                req.header('content-md5', null),
                                req.header('accept', null),
                                req.href(),
                                req.path(),
                                (req.isKeepAlive() ? 1 : 0),
                                req.version(),
                                (req.isSecure() ? 1 : 0),
                                (req.isChunked() ? 1 : 0)
                        ];

                        return (details);
                });
        };

        obj.done = function fireProbeDone(req, res) {
                pDone.fire(function probeDone() {
                        var details = [
                                req.connection.fd,
                                req.id(),
                                res.statusCode || 200,
                                (res.get('content-type') || null),
                                (res.get('content-length') || 0),
                                (res.get('content-md5') || 0),
                                (res.get('api-version') || null)
                        ];

                        return (details);
                });
        };

        return (obj);
}



///--- Exports

module.exports = {

        addProbes: addProbes
};
