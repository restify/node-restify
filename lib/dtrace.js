// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');


///--- API

function addProbes(dtrace, name) {
        assert.object(dtrace, 'dtrace');
        assert.string(name, 'name');

        var obj = {};

        // id, requestid, user, user-agent, content-type, content-length
        dtrace.addProbe(name + '-start',
                        'int',
                        'char *',
                        'char *',
                        'char *',
                        'char *',
                        'int');

        // id, requestid, statusCode, content-type, content-length
        dtrace.addProbe(name + '-done',
                        'int',
                        'char *',
                        'int',
                        'char *',
                        'int',
                        'int');

        obj.start = function fireProbeStart(req) {
                dtrace.fire(name + '-start',
                            function probeStart() {
                                    var details = [
                                            req.connection.fd,
                                            req.id,
                                            (req.username || null),
                                            (req.userAgent || null),
                                            req.contentType,
                                            (req.contentLength || 0)
                                    ];

                                    return (details);
                            });
        };

        obj.done = function fireProbeDone(req, res) {
                dtrace.fire(name + '-done',
                            function probeDone() {
                                    var details = [
                                            req.connection.fd,
                                            req.id,
                                            res.code,
                                            (res.contentType || null),
                                            (res.contentLength || 0)
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
