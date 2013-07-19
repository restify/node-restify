/**
 * Dependencies
 */

var csv    = require('csv');
var assert = require('assert-plus');
var bodyReader = require('./body_reader');
var errors = require('../errors');

///--- API

/**
 * Returns a plugin that will parse the HTTP request body if the
 * contentType is `text/csv` or `text/tsv`
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */

function fieldedTextParser(options) {

        assert.optionalObject(options, 'options');
        options = options || {};

        function parseFieldedText(req, res, next) {

                var contentType = req.getContentType();

                if (contentType !== 'text/csv' &&
                        contentType !== 'text/tsv' &&
                        contentType !== 'text/tab-separated-values' ||
                        !req.body) {
                        next();
                        return;
                }


                var hDelimiter = req.headers['x-content-delimiter'];
                var hEscape = req.headers['x-content-escape'];
                var hQuote = req.headers['x-content-quote'];
                var hColumns = req.headers['x-content-columns'];


                var delimiter = (contentType === 'text/tsv') ? '\t' : ',';
                delimiter = (hDelimiter) ? hDelimiter : delimiter;
                var escape = (hEscape) ? hEscape : '\\';
                var quote = (hQuote) ? hQuote : '"';
                var columns = (hColumns) ? hColumns : true;

                var parsedBody = [];

                csv()
                .from(req.body, {
                  delimiter: delimiter,
                  quote: quote,
                  escape: escape,
                  columns: columns
                })
                .on('record', function (row, index) {
                  row.index = index;
                  parsedBody.push(row);
                })
                .on('end', function (count) {
                  req.body = parsedBody;
                  return (next());
                })
                .on('error', function (error) {
                  return (next(error));
                });

        }

        var chain = [];
        if (!options.bodyReader) {
          chain.push(bodyReader(options));
        }
        chain.push(parseFieldedText);

        return (chain);

}

module.exports = fieldedTextParser;
