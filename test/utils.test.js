/* Express eTag test, from: https://github.com/visionmedia/express */

var
  utils = require('../lib/utils');

if (require.cache[__dirname + '/lib/helper.js'])
  delete require.cache[__dirname + '/lib/helper.js'];
var helper = require('./lib/helper.js');

///--- Globals
var test = helper.test;

var
  str = 'Hello CRC',
  strUTF8 = '<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body><p>自動販売</p></body></html>';

test('ETag generator should support strings', function (t) {
  t.equal(utils.etag(str), '"-2034458343"');
  t.end();
});

test('ETag generator should support utf8 strings', function (t) {
  t.equal(utils.etag(strUTF8), '"1395090196"');
  t.end();
});

test('ETag generator should support buffer', function (t) {
  t.equal(utils.etag(strUTF8), '"1395090196"');
  t.equal(utils.etag(str), '"-2034458343"');
  t.end();
});
