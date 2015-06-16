# restify

[![Build Status](https://travis-ci.org/restify/node-restify.svg)](https://travis-ci.org/restify/node-restify)
[![Gitter chat](https://badges.gitter.im/mcavage/node-restify.svg)](https://gitter.im/mcavage/node-restify)
[![Dependency Status](https://david-dm.org/restify/node-restify.svg)](https://david-dm.org/restify/node-restify)
[![devDependency Status](https://david-dm.org/restify/node-restify/dev-status.svg)](https://david-dm.org/restify/node-restify#info=devDependencies)
[![bitHound Score](https://www.bithound.io/github/restify/node-restify/badges/score.svg)](https://www.bithound.io/github/restify/node-restify/master)

[restify](http://restifyjs.com) is a smallish framework,
similar to [express](http://expressjs.com) for building REST APIs.  For full
details, see http://restify.com

Join us on IRC at `irc.freenode.net` in the `#restify` channel for real-time
chat and support.

# Usage

## Server
```javascript
var restify = require('restify');

var server = restify.createServer({
  name: 'myapp',
  version: '1.0.0'
});
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/echo/:name', function (req, res, next) {
  res.send(req.params);
  return next();
});

server.listen(8080, function () {
  console.log('%s listening at %s', server.name, server.url);
});
```

## Client
```javascript
var assert = require('assert');
var restify = require('restify');

var client = restify.createJsonClient({
  url: 'http://localhost:8080',
  version: '~1.0'
});

client.get('/echo/mark', function (err, req, res, obj) {
  assert.ifError(err);
  console.log('Server returned: %j', obj);
});
```

# Installation

    $ npm install restify

## License

The MIT License (MIT)
Copyright (c) 2012 Mark Cavage

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Bugs

See <https://github.com/restify/node-restify/issues>.

## Mailing list

See the
[Google group](https://groups.google.com/forum/?hl=en&fromgroups#!forum/restify)
.
