// Copyright (c) 2013, Joyent, Inc. All rights reserved.

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var assert = require('assert-plus');

function InvalidUpgradeStateError(msg) {
        if (Error.captureStackTrace)
                Error.captureStackTrace(this, InvalidUpgradeStateError);

        this.message = msg;
        this.name = 'InvalidUpgradeStateError';
}
util.inherits(InvalidUpgradeStateError, Error);

//
// The Node HTTP Server will, if we handle the 'upgrade' event, swallow any
// Request with the 'Connection: upgrade' header set.  While doing this it
// detaches from the 'data' events on the Socket and passes the socket to
// us, so that we may take over handling for the connection.
//
// Unfortunately, the API does not presently provide a http.ServerResponse
// for us to use in the event that we do not wish to upgrade the connection.
// This factory method provides a skeletal implementation of a
// restify-compatible response that is sufficient to allow the existing
// request handling path to work, while allowing us to perform _at most_ one
// of either:
//
//   - Return a basic HTTP Response with a provided Status Code and
//     close the socket.
//   - Upgrade the connection and stop further processing.
//
// To determine if an upgrade is requested, a route handler would check for
// the 'claimUpgrade' method on the Response.  The object this method
// returns will have the 'socket' and 'head' Buffer emitted with the
// 'upgrade' event by the http.Server.  If the upgrade is not possible, such
// as when the HTTP head (or a full request) has already been sent by some
// other handler, this method will throw.
//
function createServerUpgradeResponse(req, socket, head) {
        return (new ServerUpgradeResponse(socket, head));
}

function ServerUpgradeResponse(socket, head) {
        assert.object(socket, 'socket');
        assert.buffer(head, 'head');

        EventEmitter.call(this);

        this.sendDate = true;
        this.statusCode = 400;

        this._upgrade = {
                socket: socket,
                head: head
        };

        this._headWritten = false;
        this._upgradeClaimed = false;
}
util.inherits(ServerUpgradeResponse, EventEmitter);

function notImplemented(method) {
        if (!method.throws) {
                return function () {
                        return (method.returns);
                };
        } else {
                return function () {
                        throw (new Error('Method ' + method.name + ' is not ' +
                            'implemented!'));
                };
        }
}

var NOT_IMPLEMENTED = [
        { name: 'writeContinue', throws: true },
        { name: 'setHeader', throws: false, returns: null },
        { name: 'getHeader', throws: false, returns: null },
        { name: 'getHeaders', throws: false, returns: {} },
        { name: 'removeHeader', throws: false, returns: null },
        { name: 'addTrailer', throws: false, returns: null },
        { name: 'cache', throws: false, returns: 'public' },
        { name: 'format', throws: true },
        { name: 'set', throws: false, returns: null },
        { name: 'get', throws: false, returns: null },
        { name: 'headers', throws: false, returns: {} },
        { name: 'header', throws: false, returns: null },
        { name: 'json', throws: false, returns: null },
        { name: 'link', throws: false, returns: null }
];
NOT_IMPLEMENTED.forEach(function (method) {
        ServerUpgradeResponse.prototype[method.name] = notImplemented(method);
});

ServerUpgradeResponse.prototype._writeHeadImpl = function _writeHeadImpl(
statusCode, reason) {
        if (this._headWritten)
                return;
        this._headWritten = true;

        if (this._upgradeClaimed)
                throw new InvalidUpgradeStateError('Upgrade already claimed!');

        var head = [
                'HTTP/1.1 ' + statusCode + ' ' + reason,
                'Connection: close'
        ];
        if (this.sendDate)
                head.push('Date: ' + new Date().toUTCString());

        this._upgrade.socket.write(head.join('\r\n') + '\r\n');
};

ServerUpgradeResponse.prototype.status = function status(code) {
        assert.number(code, 'code');
        this.statusCode = code;
        return (code);
};

ServerUpgradeResponse.prototype.send = function send(code, body) {
        if (typeof (code) === 'number')
                this.statusCode = code;
        else
                body = code;

        if (typeof (body) === 'object') {
                if (typeof (body.statusCode) === 'number')
                        this.statusCode = body.statusCode;
                if (typeof (body.message) === 'string')
                        this.statusReason = body.message;
        }

        return (this.end());
};

ServerUpgradeResponse.prototype.end = function end() {
        this._writeHeadImpl(this.statusCode, 'Connection Not Upgraded');
        this._upgrade.socket.end('\r\n');
        return (true);
};

ServerUpgradeResponse.prototype.write = function write() {
        this._writeHeadImpl(this.statusCode, 'Connection Not Upgraded');
        return (true);
};

ServerUpgradeResponse.prototype.writeHead = function writeHead(statusCode,
reason) {
        assert.number(statusCode, 'statusCode');
        assert.optionalString(reason, 'reason');

        this.statusCode = statusCode;
        if (!reason)
                reason = 'Connection Not Upgraded';

        if (this._headWritten)
                throw new Error('Head already written!');

        return (this._writeHeadImpl(statusCode, reason));
};

ServerUpgradeResponse.prototype.claimUpgrade = function claimUpgrade() {
        if (this._upgradeClaimed)
                throw new InvalidUpgradeStateError('Upgrade already claimed!');

        if (this._headWritten)
                throw new InvalidUpgradeStateError('Upgrade already aborted!');

        this._upgradeClaimed = true;

        return (this._upgrade);
};

module.exports = {
        createResponse: createServerUpgradeResponse,

        InvalidUpgradeStateError: InvalidUpgradeStateError
};

// vim: set et ts=8 sts=8 sw=8:
