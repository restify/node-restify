// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Helpers

/**
 * this pre handler fixes issues with node hanging when an asyncHandler is
 * used prior to bodyParser.
 * https://github.com/restify/node-restify/issues/287
 * https://github.com/restify/node-restify/issues/409
 * https://github.com/restify/node-restify/wiki/1.4-to-2.0-Migration-Tips
 * @public
 * @function pauseStream
 * @param    {Stream} stream the stream to pause
 * @returns  {undefined}
 */
function pauseStream(stream) {
    function _buffer(chunk) {
        stream.__buffered.push(chunk);
    }

    function _catchEnd(chunk) {
        stream.__rstfy_ended = true;
    }

    stream.__rstfy_ended = false;
    stream.__rstfy_paused = true;
    stream.__buffered = [];
    stream.on('data', _buffer);
    stream.once('end', _catchEnd);
    stream.pause();

    stream._resume = stream.resume;
    stream.resume = function _rstfy_resume() {
        if (!stream.__rstfy_paused) {
            return;
        }

        stream.removeListener('data', _buffer);
        stream.removeListener('end', _catchEnd);

        stream.__buffered.forEach(stream.emit.bind(stream, 'data'));
        stream.__buffered.length = 0;

        stream._resume();
        stream.resume = stream._resume;

        if (stream.__rstfy_ended) {
            stream.emit('end');
        }
    };
}


///--- Exports

module.exports = function pause() {

    function prePause(req, res, next) {
        pauseStream(req);
        next();
    }

    return (prePause);
};
