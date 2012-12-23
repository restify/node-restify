// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var os = require('os');
var socketio = require('socket.io');

var restify = require('../lib');



///--- Globals

var IP = (function () {
        var nics = os.networkInterfaces();
        var keys = Object.keys(nics).filter(function (k) {
                return (nics[k].some(function (n) {
                        return (!n.internal);
                }));
        });
        return (nics[keys.pop()].pop().address);
})();

var HTML = '<script src="/socket.io/socket.io.js"></script>\n' +
        '<script>\n' +
          'var socket = io.connect("http://' + IP + ':8080");\n' +
          'socket.on("news", function (data) {\n' +
            'console.log(data);\n' +
            'socket.emit("my other event", { my: "data" });\n' +
        '});\n' +
        '</script>';



///--- Mainline

var server = restify.createServer();
var io = socketio.listen(server);

server.get('/', function indexHTML(req, res, next) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Length', Buffer.byteLength(HTML));
        res.writeHead(200);
        res.write(HTML);
        res.end();
        next();
});


io.sockets.on('connection', function (socket) {
        socket.emit('news', { hello: 'world' });
        socket.on('my other event', function (data) {
                console.log(data);
        });
});

server.listen(8080, IP, function () {
        console.log('socket.io server listening at %s', server.url);
});
