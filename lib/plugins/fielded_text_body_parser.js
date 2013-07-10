/**
 * Dependencies
 */

var csv    = require('csv');
var assert = require('assert-plus');
var errors = require('../errors');

///--- API

/**
 * Returns a plugin that will parse the HTTP request body if the
 * contentType is `text/csv` or `text/tsv`
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */

function fieldedTextParser( options ) {
  assert.optionalObject(options, 'options');
  options = options || {};

  function parseFieldedText( req, res, next ) {
    if ( req.getContentType() !== 'text/csv' && req.getContentType() !== 'text/tsv' && req.getContentType() !== 'text/tab-separated-values' || !req.body ) {
      return next();
    }
    
    var delimiter = (req.getContentType() === 'text/tsv') ? '\t' : ',';
        delimiter = (req.headers['x-content-delimiter']) ? req.headers['x-content-delimiter'] : delimiter;
    var escape = (req.headers['x-content-escape']) ? req.headers['x-content-escape'] : '\\';
    var quote = (req.headers['x-content-delimiter']) ? req.headers['x-content-delimiter'] : '"';
    var columns = (req.headers['x-content-columns']) ? req.headers['x-content-columns'] : true;

    var parsedBody = [];

    csv()
    .from(req.body, {
      delimiter: delimiter,
      quote: quote,
      escape: escape,
      columns: columns,
    })
    .on('record', function( row, index ) {
      row.index = index;
      parsedBody.push( row );
    })
    .on('end', function( count ) {
      req.body = parsedBody;
      return next();
    })
    .on('error', function( error ) {
      console.log(error.message);
      return next( error );
    });

  };

  return parseFieldedText;

}

module.exports = fieldedTextParser;
