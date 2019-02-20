<!-- Please don't remove this: Grab your social icons from https://github.com/carlsednaoui/gitsocial -->

<!-- display the social media buttons in your README -->

[![alt text][1.1]][1]


<!-- links to social media icons -->
<!-- no need to change these -->

<!-- icons with padding -->

[1.1]: http://i.imgur.com/tXSoThF.png (twitter icon with padding)

<!-- icons without padding -->

[1.2]: http://i.imgur.com/wWzX9uB.png (twitter icon without padding)


<!-- links to your social media accounts -->
<!-- update these accordingly -->

[1]: http://www.twitter.com/restifyjs

<!-- Please don't remove this: Grab your social icons from https://github.com/carlsednaoui/gitsocial -->

![restify](/../gh-images/logo/png/restify_logo_black_transp_288x288.png?raw=true "restify")

[![Build Status](https://travis-ci.org/restify/node-restify.svg?branch=master)](https://travis-ci.org/restify/node-restify)
[![Dependency Status](https://david-dm.org/restify/node-restify.svg)](https://david-dm.org/restify/node-restify)
[![devDependency Status](https://david-dm.org/restify/node-restify/dev-status.svg)](https://david-dm.org/restify/node-restify#info=devDependencies)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

[restify](http://restify.com) is a framework, utilizing
[connect](https://github.com/senchalabs/connect) style middleware for building
REST APIs.  For full details, see http://restify.com

Follow restify on [![alt text][1.2]][1]

# Usage

## Server
```javascript
var restify = require('restify');

const server = restify.createServer({
  name: 'myapp',
  version: '1.0.0'
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

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
var clients = require('restify-clients');

var client = clients.createJsonClient({
  url: 'http://localhost:8080',
  version: '~1.0'
});

client.get('/echo/mark', function (err, req, res, obj) {
  assert.ifError(err);
  console.log('Server returned: %j', obj);
});
```

# Installation
```bash
$ npm install restify
```

## Supported Node Versions

Restify aims to support the Node.js LTS (Active and Maintenance) versions along with Node.js current stable version.

| Node Release  | Supported in Current Version | Notes    |
| :--:     | :---: | :---:       | 
| 11.x | **Yes**      | Current stable | 
| 10.x | **Yes**      | Active LTS | 
| 8.x  | **Yes** | Maintenance LTS  | 
| 6.x  | **No** | Use restify v7.x, team will backport critical issues only   | 
| 4.x  | **No** | Use restify v7.x, team will backport critical issues only  | 

## License

The MIT License (MIT)

Copyright (c) 2018 restify

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

## Other repositories

- For the errors module, please go [here](https://github.com/restify/errors).


## Mailing list

See the
[Google group](https://groups.google.com/forum/?hl=en&fromgroups#!forum/restify)
.
