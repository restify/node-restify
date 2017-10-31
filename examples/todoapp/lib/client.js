// Copyright (c) 2012 Mark Cavage. All rights reserved.

var util = require('util');

var assert = require('assert-plus');
var restify = require('restify');

///--- Globals

var sprintf = util.format;

///--- API

function TodoClient(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');
    assert.optionalString(options.socketPath, 'options.socketPath');
    assert.optionalString(options.url, 'options.url');
    assert.optionalString(options.version, 'options.version');

    var ver = options.version || '~1.0';

    this.client = restify.createClient({
        log: options.log,
        name: 'TodoClient',
        socketPath: options.socketPath,
        type: 'json',
        url: options.url,
        version: ver
    });
    this.log = options.log.child({ component: 'TodoClient' }, true);
    this.url = options.url;
    this.version = ver;

    if (options.username && options.password) {
        this.username = options.username;
        this.client.basicAuth(options.username, options.password);
    }
}

TodoClient.prototype.create = function create(task, cb) {
    assert.string(task, 'task');
    assert.func(cb, 'callback');

    this.client.post('/todo', { task: task }, function(err, req, res, obj) {
        if (err) {
            cb(err);
        } else {
            cb(null, obj);
        }
    });
};

TodoClient.prototype.list = function list(cb) {
    assert.func(cb, 'callback');

    this.client.get('/todo', function(err, req, res, obj) {
        if (err) {
            cb(err);
        } else {
            cb(null, obj);
        }
    });
};

TodoClient.prototype.get = function get(name, cb) {
    assert.string(name, 'name');
    assert.func(cb, 'callback');

    this.client.get('/todo/' + name, function(err, req, res, obj) {
        if (err) {
            cb(err);
        } else {
            cb(null, obj);
        }
    });
};

TodoClient.prototype.update = function update(todo, cb) {
    assert.object(todo, 'todo');
    assert.func(cb, 'callback');

    this.client.put('/todo/' + todo.name, todo, function(err) {
        if (err) {
            cb(err);
        } else {
            cb(null);
        }
    });
};

TodoClient.prototype.del = function del(name, cb) {
    if (typeof name === 'function') {
        cb = name;
        name = '';
    }
    assert.string(name, 'name');
    assert.func(cb, 'callback');

    var p = '/todo' + (name.length > 0 ? '/' + name : '');
    this.client.del(p, function(err) {
        if (err) {
            cb(err);
        } else {
            cb(null);
        }
    });
};

TodoClient.prototype.toString = function toString() {
    var str = sprintf(
        '[object TodoClient<url=%s, username=%s, version=%s]',
        this.url,
        this.username || 'null',
        this.version
    );
    return str;
};

///--- API

module.exports = {
    createClient: function createClient(options) {
        return new TodoClient(options);
    }
};
