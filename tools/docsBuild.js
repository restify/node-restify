'use strict';

var glob = require('glob');
var path = require('path');
var util = require('util');
var fs = require('fs');
var documentation = require('documentation');

var DOCS_PATH = '../docs';
var OUTPUT_PATH = '../docs/_api';
var LIB_PATH = '../lib';
var JEKYLL_HEADER_TEMPLATE = '---\ntitle: %s\npermalink: %s\n---\n\n%s';

var docsConfig = [
    {
        title: 'Server API',
        permalink: '/docs/server-api/',
        output: path.join(__dirname, OUTPUT_PATH, 'server.md'),
        files: [
            path.join(__dirname, LIB_PATH, 'index.js'),
            path.join(__dirname, LIB_PATH, 'server.js')
        ],
        config: path.join(__dirname, DOCS_PATH, 'config/server.yaml')
    },
    {
        title: 'Request API',
        permalink: '/docs/request-api/',
        output: path.join(__dirname, OUTPUT_PATH, 'request.md'),
        files: [path.join(__dirname, LIB_PATH, 'request.js')],
        config: path.join(__dirname, DOCS_PATH, 'config/request.yaml')
    },
    {
        title: 'Response API',
        permalink: '/docs/response-api/',
        output: path.join(__dirname, OUTPUT_PATH, 'response.md'),
        files: [path.join(__dirname, LIB_PATH, 'response.js')]
    },
    {
        title: 'Plugins API',
        permalink: '/docs/plugins-api/',
        output: path.join(__dirname, OUTPUT_PATH, 'plugins.md'),
        files: [
            // Pre plugins
            path.join(__dirname, LIB_PATH, 'plugins/pre/context.js'),
            path.join(__dirname, LIB_PATH, 'plugins/pre/dedupeSlashes.js'),
            path.join(__dirname, LIB_PATH, 'plugins/pre/pause.js'),
            path.join(__dirname, LIB_PATH, 'plugins/pre/prePath.js'),
            path.join(__dirname, LIB_PATH, 'plugins/pre/reqIdHeaders.js'),
            path.join(__dirname, LIB_PATH, 'plugins/pre/strictQueryParams.js'),
            path.join(__dirname, LIB_PATH, 'plugins/pre/userAgent.js'),
            // Use plugins
            path.join(__dirname, LIB_PATH, 'plugins/accept.js'),
            path.join(__dirname, LIB_PATH, 'plugins/authorization.js'),
            path.join(__dirname, LIB_PATH, 'plugins/date.js'),
            path.join(__dirname, LIB_PATH, 'plugins/query.js'),
            path.join(__dirname, LIB_PATH, 'plugins/jsonp.js'),
            path.join(__dirname, LIB_PATH, 'plugins/bodyParser.js'),
            path.join(__dirname, LIB_PATH, 'plugins/requestLogger.js'),
            path.join(__dirname, LIB_PATH, 'plugins/gzip.js'),
            path.join(__dirname, LIB_PATH, 'plugins/static.js'),
            path.join(__dirname, LIB_PATH, 'plugins/staticFiles.js'),
            path.join(__dirname, LIB_PATH, 'plugins/throttle.js'),
            path.join(__dirname, LIB_PATH, 'plugins/requestExpiry.js'),
            path.join(
                __dirname,
                LIB_PATH,
                'plugins/inflightRequestThrottle.js'
            ),
            path.join(__dirname, LIB_PATH, 'plugins/cpuUsageThrottle.js'),
            path.join(__dirname, LIB_PATH, 'plugins/conditionalHandler.js'),
            path.join(__dirname, LIB_PATH, 'plugins/conditionalRequest.js'),
            path.join(__dirname, LIB_PATH, 'plugins/audit.js'),
            path.join(__dirname, LIB_PATH, 'plugins/metrics.js')
        ],
        config: path.join(__dirname, DOCS_PATH, 'config/plugins.yaml')
    },
    {
        title: 'Formatters API',
        permalink: '/docs/formatters-api/',
        output: path.join(__dirname, OUTPUT_PATH, 'formatters.md'),
        files: glob.sync(path.join(__dirname, LIB_PATH, 'formatters', '*')),
        config: path.join(__dirname, DOCS_PATH, 'config/formatters.yaml')
    }
];

/**
 * @function build
 * @param {Object} options - Options
 * @param {Array} options.files - Array of file paths ["./foo.js"]
 * @param {String} options.config - Path to "config.yaml"
 * @param {String} options.output - Path to output dir
 * @param {String} options.title - Jekyll title
 * @param {String} options.permalink - Jekyll permalink
 * @returns {Promise} - Promise
 */
function build(options) {
    return documentation
        .build(options.files, {
            shallow: true,
            config: options.config
        })
        .then(function docsFormat(docs) {
            return documentation.formats.md(docs, {
                markdownToc: true
            });
        })
        .then(function docsWrite(docsContent) {
            var output = util.format(
                JEKYLL_HEADER_TEMPLATE,
                options.title,
                options.permalink,
                docsContent
            );

            fs.writeFileSync(options.output, output);
        });
}

// eslint-disable-next-line
Promise.all(docsConfig.map(build))
    .then(function onSucceed(res) {
        console.log('Docs built');
        process.exit(0);
    })
    .catch(function onError(err) {
        console.error(err);
        process.exit(1);
    });
