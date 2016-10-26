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
chat and support. Or see the
[Google group](https://groups.google.com/forum/?hl=en&fromgroups#!forum/restify).


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

Note that in future versions of restify, the clients have moved to a
separate [restify-clients](https://github.com/restify/clients) repository
and npm package.


# Installation

    npm install restify


# License

MIT (see "LICENSE" file).


# Development

## Bugs

See <https://github.com/restify/node-restify/issues>.

## Release process

Here is how to cut a release:

1. Update the version in "package.json" and change `## not yet released` at
   the top of "CHANGES.md" to:

    ```
    ## not yet released


    ## $version
    ```

2. Ensure things are correct by running `make versioncheck`, then commit
   your change, with something like:

    ```
    git commit -am "$version"
    git push origin
    ```

3. Run the following to tag and publish the release:

    ```
    make cutarelease
    ```
