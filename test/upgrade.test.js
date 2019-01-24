// Copyright (c) 2013, Joyent, Inc. All rights reserved.
// vim: set ts=8 sts=8 sw=8 et:

'use strict';
/* eslint-disable func-names */

var restifyClients = require('restify-clients');
var Watershed = require('watershed').Watershed;
var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;
var WATERSHED = new Watershed();
var SHEDLIST = [];

var TIMEOUT = 15000;

///--- Test Helper

function finish_latch(_test, _names) {
    var complete = false;
    var t = _test;
    var names = _names;
    var iv = setTimeout(function() {
        if (complete) {
            return;
        }

        complete = true;
        t.ok(false, 'timeout after ' + TIMEOUT + 'ms');
        t.ok(false, 'remaining latches: ' + Object.keys(names).join(', '));
        t.done();
    }, TIMEOUT);
    return function(name, err) {
        if (complete) {
            return;
        }

        if (names[name] === undefined) {
            complete = true;
            t.ok(false, 'latch name "' + name + '" not expected');
            t.ok(false, 'remaining latches: ' + Object.keys(names).join(', '));
            t.done();
            return;
        }

        if (--names[name] === 0) {
            delete names[name];
        }

        /*
         * Check that all latch names are done, and if so,
         * end the test:
         */
        if (Object.keys(names).length === 0) {
            complete = true;
            clearTimeout(iv);
            iv = null;
            t.done();
        }
    };
}

///--- Tests

before(function(cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3'],
            handleUpgrades: true
        });
        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createHttpClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

after(function(cb) {
    try {
        CLIENT.close();
        SERVER.close(function() {
            CLIENT = null;
            SERVER = null;
            cb();
        });

        while (SHEDLIST.length > 0) {
            SHEDLIST.pop().destroy();
        }
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('GET without upgrade headers', function(t) {
    var done = finish_latch(t, {
        'client response': 1,
        'server response': 1
    });

    SERVER.get('/attach', function(req, res, next) {
        t.ok(!res.claimUpgrade, 'res.claimUpgrade not present');
        res.send(400);
        next();
        done('server response');
    });

    var options = {
        headers: {
            uprgade: 'ebfrockets' // this is intentional misspelling of upgrade
        },
        path: '/attach'
    };
    CLIENT.get(options, function(err, req) {
        t.ifError(err);
        req.on('error', function(err2) {
            t.ifError(err2);
            done('client error');
        });
        req.on('result', function(err2, res) {
            if (err2 && err2.name !== 'BadRequestError') {
                t.ifError(err2);
            }
            t.equal(res.statusCode, 400);
            res.on('end', function() {
                done('client response');
            });
            res.resume();
        });
        req.on('upgradeResult', function(err2, res) {
            done('server upgraded unexpectedly');
        });
    });
});

test('Dueling upgrade and response handling 1', function(t) {
    var done = finish_latch(t, {
        'expected requestUpgrade error': 1,
        'client response': 1
    });

    SERVER.get('/attach', function(req, res, next) {
        try {
            res.send(400);
        } catch (ex) {
            t.ifError(ex);
            done('unxpected res.send error');
            return;
        }

        try {
            var upg = res.claimUpgrade();
            upg.socket.destroy();
        } catch (ex) {
            done('expected requestUpgrade error');
        }
        next(false);
    });

    var wskey = WATERSHED.generateKey();
    var options = {
        headers: {
            connection: 'upgrade',
            upgrade: 'websocket',
            'sec-websocket-key': wskey
        },
        path: '/attach'
    };
    CLIENT.get(options, function(err, req) {
        t.ifError(err);
        req.on('error', function(err2) {
            t.ifError(err2);
            done('client error');
        });
        req.on('result', function(err2, res) {
            if (err2 && err2.name !== 'BadRequestError') {
                t.ifError(err2);
            }
            t.equal(res.statusCode, 400);
            res.on('end', function() {
                done('client response');
            });
            res.resume();
        });
        req.on('upgradeResult', function(err2, res) {
            done('server upgraded unexpectedly');
        });
    });
});

test('Dueling upgrade and response handling 2', function(t) {
    var done = finish_latch(t, {
        'expected res.send error': 1,
        'expected server to reset': 1
    });

    SERVER.get('/attach', function(req, res, next) {
        try {
            var upg = res.claimUpgrade();
            upg.socket.destroy();
        } catch (ex) {
            t.ifError(ex);
            done('unexpected requestUpgrade error');
        }

        try {
            res.send(400);
        } catch (ex) {
            if (ex.name !== 'InvalidUpgradeStateError') {
                t.ifError(ex);
            }
            done('expected res.send error');
            return;
        }

        next(false);
    });

    var wskey = WATERSHED.generateKey();
    var options = {
        headers: {
            connection: 'upgrade',
            upgrade: 'websocket',
            'sec-websocket-key': wskey
        },
        path: '/attach'
    };
    CLIENT.get(options, function(err, req) {
        t.ifError(err);
        done('expected server to reset');
        return;
    });
});

test('GET with upgrade headers', function(t) {
    var done = finish_latch(t, {
        'client shed end': 1,
        'server shed end': 1
    });

    SERVER.get('/attach', function(req, res, next) {
        t.ok(res.claimUpgrade, 'res.claimUpgrade present');
        t.doesNotThrow(function() {
            var upgrade = res.claimUpgrade();
            var shed = WATERSHED.accept(req, upgrade.socket, upgrade.head);
            SHEDLIST.push(shed);
            shed.end("ok we're done here");
            shed.on('error', function(err) {
                t.ifError(err);
                done('server shed error');
            });
            shed.on('end', function() {
                done('server shed end');
            });
            next(false);
        });
    });

    var wskey = WATERSHED.generateKey();
    var options = {
        headers: {
            connection: 'upgrade',
            upgrade: 'websocket',
            'sec-websocket-key': wskey
        },
        path: '/attach'
    };
    CLIENT.get(options, function(err, req) {
        t.ifError(err);
        req.on('result', function(err2, res) {
            t.ifError(err2);
            t.ok(false, 'server did not upgrade');
            done(true);
        });
        req.on('upgradeResult', function(err2, res, socket, head) {
            t.ifError(err2);
            t.ok(true, 'server upgraded');
            t.equal(res.statusCode, 101);
            t.equal(typeof socket, 'object');
            t.ok(Buffer.isBuffer(head), 'head is Buffer');
            t.doesNotThrow(function() {
                var shed = WATERSHED.connect(res, socket, head, wskey);
                SHEDLIST.push(shed);
                shed.end('ok, done');
                shed.on('error', function(err3) {
                    t.ifError(err3);
                    done('client shed error');
                });
                shed.on('end', function() {
                    done('client shed end');
                });
            });
        });
    });
});

test('GET with some websocket traffic', function(t) {
    var done = finish_latch(t, {
        'client shed end': 1,
        'server shed end': 1,
        'server receive message': 5,
        'client receive message': 3
    });

    SERVER.get('/attach', function(req, res, next) {
        t.ok(res.claimUpgrade, 'res.claimUpgrade present');
        t.doesNotThrow(function() {
            var upgrade = res.claimUpgrade();
            var shed = WATERSHED.accept(req, upgrade.socket, upgrade.head);
            SHEDLIST.push(shed);
            shed.on('error', function(err) {
                t.ifError(err);
                done('server shed error');
            });
            shed.on('text', function(msg) {
                if (msg === 'to server') {
                    done('server receive message');
                }
            });
            shed.on('end', function() {
                done('server shed end');
            });
            shed.send('to client');
            shed.send('to client');
            shed.send('to client');
            next(false);
        });
    });

    var wskey = WATERSHED.generateKey();
    var options = {
        headers: {
            connection: 'upgrade',
            upgrade: 'websocket',
            'sec-websocket-key': wskey
        },
        path: '/attach'
    };
    CLIENT.get(options, function(err, req) {
        t.ifError(err);
        req.on('result', function(err2, res) {
            t.ifError(err2);
            t.ok(false, 'server did not upgrade');
            done(true);
        });
        req.on('upgradeResult', function(err2, res, socket, head) {
            t.ifError(err2);
            t.ok(true, 'server upgraded');
            t.equal(res.statusCode, 101);
            t.equal(typeof socket, 'object');
            t.ok(Buffer.isBuffer(head), 'head is Buffer');
            t.doesNotThrow(function() {
                var shed = WATERSHED.connect(res, socket, head, wskey);
                SHEDLIST.push(shed);
                shed.on('error', function(err3) {
                    t.ifError(err3);
                    done('client shed error');
                });
                shed.on('end', function() {
                    done('client shed end');
                });
                shed.on('text', function(msg) {
                    if (msg === 'to client') {
                        done('client receive message');
                    }
                });
                var count = 5;
                var iv = setInterval(function() {
                    if (--count < 0) {
                        clearInterval(iv);
                        shed.end();
                    } else {
                        shed.send('to server');
                    }
                }, 100);
            });
        });
    });
});
