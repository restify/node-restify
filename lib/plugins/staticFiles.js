'use strict';
var assert = require('assert-plus');
var errors = require('restify-errors');
var path = require('path');
var send = require('send');
var shallowCopy = require('./utils/shallowCopy');

///--- Globals
var MethodNotAllowedError = errors.MethodNotAllowedError;
var NotAuthorizedError = errors.NotAuthorizedError;
var ResourceNotFoundError = errors.ResourceNotFoundError;

/**
 * Serves static files, with API similar to expressjs
 *
 * @public
 * @function serveStaticFiles
 * @param    {String} directory - the directory to serve files from
 * @param    {Object} opts - an options object, which is optional
 * @param    {Number} [opts.maxAge=0] - specify max age in millisecs
 * @param    {Boolean} [opts.etag=true] - enable/disable etag, default = true
 * @param    {Function} [opts.setHeaders] - set custom headers for the Files
 * (synchronously), The function is called as `fn(res, path, stat)`,
 * where the arguments are:
 *      `res` the response object
 *      `path` the file path that is being sent
 *      `stat` the stat object of the file that is being sent
 * @throws   {MethodNotAllowedError}
 * @throws   {NotAuthorizedError}
 * @throws   {ResourceNotFoundError}
 * @returns  {Function} Handler
 * @example
 * <caption>
 * The serveStaticFiles plugin allows you to map a GET route to a
 * directory on the disk
 * </caption>
 * server.get('/public/*', // don't forget the `/*`
 *      restify.plugins.serveStaticFiles('./documentation/v1')
 * );
 * @example
 * <caption>
 * The GET `route` and `directory` combination will serve a file
 * located in `./documentation/v1/index.html` when you attempt to hit
 * `http://localhost:8080/public/index.html`
 *
 * The plugin uses [send](https://github.com/pillarjs/send) under the hood
 * which is also used by `expressjs` to serve static files. Most of the options
 * that work with `send` will work with this plugin.
 *
 * The default file the plugin looks for is `index.html`
 * </caption>
 * server.get('/public/*',
 *      restify.plugins.serveStaticFiles('./documentation/v1', {
 *      maxAge: 3600000, // this is in millisecs
 *      etag: false,
 *      setHeaders: function setCustomHeaders(response, requestedPath, stat) {
 *              response.setHeader('restify-plugin-x', 'awesome');
 *          }
 *      })
 * );
 */
function serveStaticFiles(directory, opts) {
    // make a copy of the options that will be passed to send
    var optionsPlugin = shallowCopy(opts || {});
    var optionsSend = shallowCopy(opts || {});
    // lets assert some options
    assert.object(optionsSend, 'options');
    assert.object(optionsPlugin, 'options');
    assert.string(directory, 'directory');

    // `send` library relies on `root` to specify the root folder
    // to look for files
    optionsSend.root = path.resolve(directory);
    // `setHeaders` is only understood by our plugin
    if (optionsSend.setHeaders) {
        delete optionsSend.setHeaders;
    }

    return function handleServeStaticFiles(req, res, next) {
        // Check to make sure that this was either a GET or a HEAD request
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next(new MethodNotAllowedError('%s', req.method));
        }
        // we expect the params to have `*`:
        // This allows the router to accept any file path
        var requestedFile = req.params['*'] || 'index.html';
        // This is used only for sending back correct error message text
        var requestedFullPath = req.url;
        // Rely on `send` library to create a stream
        var stream = send(req, requestedFile, optionsSend);

        // Lets handle the various events being emitted by send module

        // stream has ended, must call `next()`
        stream.on('end', function handleEnd() {
            return next();
        });

        // when `send` encounters any `error`, we have the opportunity
        // to handle the errors here
        stream.on('error', function handleError(err) {
            var respondWithError = null;
            // When file does not exist
            if (err.statusCode === 404) {
                respondWithError = new ResourceNotFoundError(requestedFullPath);
            } else {
                // or action is forbidden (like requesting a directory)
                respondWithError = new NotAuthorizedError(requestedFullPath);
            }
            return next(respondWithError);
        });

        // If the request was for directory and that directory did not
        // have index.html, this will be called
        stream.on('directory', function handleDirectoryRequest() {
            next(new NotAuthorizedError('%s', requestedFullPath));
            return;
        });

        // stream is about to send headers, and custom headers must be
        // set now
        stream.on('headers', function handleCustomHeaders(
            response,
            requestedPath,
            stat
        ) {
            if (
                optionsPlugin.setHeaders &&
                typeof optionsPlugin.setHeaders === 'function'
            ) {
                optionsPlugin.setHeaders(response, requestedPath, stat);
            }
        });

        // pipe the stream into response
        return stream.pipe(res);
    };
}

module.exports = serveStaticFiles;
