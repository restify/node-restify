'use strict';

var restify = process.argv.includes('version=head')
    ? require('../../lib')
    : require('restify');

var server = restify.createServer();
var path = '/whiskeys/scotch/islay/lagavulin/16-years/50';
var methods = ['post', 'put', 'get', 'del', 'patch'];
var _ = require('lodash');
var port = 3000;

// Disabling cache: it's not fair as it aims to the worst case, when
// cache hit ratio is 0%. However, it's still better than the worst
// as it doesn't require extra time to maintain the LRU cache.
// There is no other way to simulate 100+ different endpoint
// calls with the current benchmark suite.
if (!process.argv.includes('version=head')) {
    server.router.cache = {
        get: function get() {
            return null;
        },
        set: function get() {
            return null;
        },
        dump: function get() {
            return [];
        }
    };
}

module.exports = {
    url: 'http://localhost:' + port + path
};

var routes = {
    beers: {
        ale: {
            'pale-ale': {
                'american-pale-ale': [],
                'indian-pale-ale': []
            },
            lambic: [],
            stout: {
                'american-porter': [],
                'imperial-stout': [],
                'irish-stout': []
            }
        },
        lager: {
            'german-lager': {
                marzen: []
            },
            pilsner: {
                'german-pilsner': []
            }
        }
    },

    whiskeys: {
        american: {
            bourbon: {
                kentchuky: {
                    'jim-beam': ['jim-beam', 'bookers', 'old-crow'],
                    'makers-mark': ['makers-mark'],
                    'woodford-reserve': ['woodford-reserve']
                },
                tennessee: {
                    'jack-daniels': ['jack-daniels']
                }
            },
            rye: {
                'beam-suntory': ['jim-beam-rye', 'knob-creek']
            }
        },
        irish: {
            'single-malt': {
                bushmills: ['bushmills'],
                connemare: ['connemare']
            },
            'single-pot': {
                redbreast: ['redbreast'],
                jameson: ['jameson-15-year']
            }
        },
        japanese: {
            nikka: ['coffeey-malt', 'blended', 'from-the-barrel'],
            hibiki: ['japanese-harmony'],
            yamazakura: ['blended']
        },
        scotch: {
            islay: {
                bruichladdich: ['25-years', 'islay-barley-2009'],
                octomore: ['7.2', 'islay-barley-8.3'],
                laphroaig: ['lore', '15-years', 'four-oak'],
                lagavulin: ['distillers-edition', '8-years', '16-years']
            }
        }
    }
};

function handler(req, res) {
    res.send('hello');
}

function attachRoute(parent, routeConfig) {
    _.map(routeConfig, function map(route, routeKey) {
        var pathChunk = _.isString(routeKey) ? routeKey : route;
        var routePath = parent + '/' + pathChunk;

        methods.forEach(function forEach(method) {
            server[method](routePath, handler);
        });

        if (_.isObject(route) || _.isArray(route)) {
            attachRoute(routePath, route);
        }
        if (_.isString(route)) {
            for (var i = 0; i <= 100; i++) {
                methods.forEach(function forEach(method) {
                    server[method](routePath + '/' + i, handler);
                });
            }
        }
    });
}

attachRoute('', routes);

if (!module.parent) {
    server.listen(port);
}
