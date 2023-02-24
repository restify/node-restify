## [9.0.0](https://www.github.com/restify/node-restify/compare/v8.6.1...v9.0.0) (2022-11-15)


### ⚠ BREAKING CHANGES

* remove deprecated usage of pino.child (#1902)
* deprecates and removes re-routing when passing a string parameter to `next()`
* removes `RequestCaptureStream` and replaces `Bunyan` with `Pino`
* adds async/await support to pre, use and handler chains
* drops suppoprt to node 8 and updates linting rules
* **server:** - Server returns `RequestCloseError` instead of `RequestAbortedError`
* **travisci:** dropping support below Node.js 4

### Features

* async/await support ([12be9e2](https://www.github.com/restify/node-restify/commit/12be9e243a407eaf7a30cbb16e399ee2a46dec93))
* deprecate req.closed ([d052b7c](https://www.github.com/restify/node-restify/commit/d052b7cec561133c002211a20dccf7cc2a8a0897))
* provide callback to uncaughtException handler ([#1766](https://www.github.com/restify/node-restify/issues/1766)) ([5e8b5e2](https://www.github.com/restify/node-restify/commit/5e8b5e2b28e32c79c413d9dec2466fe8f1135332))
* remove re-routing from handler ([#1847](https://www.github.com/restify/node-restify/issues/1847)) ([9153587](https://www.github.com/restify/node-restify/commit/9153587c023a876237c1d8bc7491fee4984d9074))
* send 500s for unhandled requests ([#1777](https://www.github.com/restify/node-restify/issues/1777)) ([885cecd](https://www.github.com/restify/node-restify/commit/885cecd7f9753b62faaa930f3cd39329057587f3))
* **audit:** Add the ability to specify a custom audit log serializer (for err, req and res) ([#1746](https://www.github.com/restify/node-restify/issues/1746)) ([6231acd](https://www.github.com/restify/node-restify/commit/6231acda7e16ce64253b08039bd0ad341126c11a))
* **chain:** schedule handlers to the next tick ([#1798](https://www.github.com/restify/node-restify/issues/1798)) ([806ed71](https://www.github.com/restify/node-restify/commit/806ed7119db9ed4cce77aef3d898aae561224dd8))
* **chain:** use nextTick instead of setImmediate ([#1808](https://www.github.com/restify/node-restify/issues/1808)) ([703470a](https://www.github.com/restify/node-restify/commit/703470ad82fd01e7f3b2197ebb7eb1b5b37975f8))
* **deps:** replace cover/istanbul with nyc ([#1823](https://www.github.com/restify/node-restify/issues/1823)) ([361f83e](https://www.github.com/restify/node-restify/commit/361f83e5acd814881c82add3e1bd06ce9ded777c))
* **first:** Handlers that execute ASAP in the req/res lifecycle ([#1756](https://www.github.com/restify/node-restify/issues/1756)) ([8178098](https://www.github.com/restify/node-restify/commit/8178098d3e85ad9bd13c536b504adf940ef08563))
* **http2:** add native HTTP/2 support ([#1489](https://www.github.com/restify/node-restify/issues/1489)) ([6b20285](https://www.github.com/restify/node-restify/commit/6b202853d62394f0448486c9b5bbc18589fd44e2))
* **plugin:** plugin to serve static files ([#1753](https://www.github.com/restify/node-restify/issues/1753)) ([a67b25f](https://www.github.com/restify/node-restify/commit/a67b25f472c7ec99e63f358b3c1e8801d6261148))
* Ability to find a route by a path ([711a489](https://www.github.com/restify/node-restify/commit/711a4897800e2ef8bc4a1a9c6cc833af71cd925d))
* add router.render() back to support hypermedia usecase ([#1752](https://www.github.com/restify/node-restify/issues/1752)) ([0700cfd](https://www.github.com/restify/node-restify/commit/0700cfd445e45401c36c4229e37e12b8220339d9)), closes [#1684](https://www.github.com/restify/node-restify/issues/1684)
* **helpers:** add compose feature ([#1660](https://www.github.com/restify/node-restify/issues/1660)) ([eb60ef4](https://www.github.com/restify/node-restify/commit/eb60ef403ad77b1dd187e199d72e7c80caca248c))
* **plugins:** context, req.get() returns the whole context ([#1739](https://www.github.com/restify/node-restify/issues/1739)) ([6e35e01](https://www.github.com/restify/node-restify/commit/6e35e01eb6d64f80c0e3db2daf4dbf3f66c35e86))
* **plugins:** do not include user-input in UnsupportedMediaTypeError message (VError fails), move it to info ([#1733](https://www.github.com/restify/node-restify/issues/1733)) ([06c220d](https://www.github.com/restify/node-restify/commit/06c220d2d9629e3510aed493a8877629bbc0c4ae))
* **req:** add restifyDone event ([#1740](https://www.github.com/restify/node-restify/issues/1740)) ([4900d6b](https://www.github.com/restify/node-restify/commit/4900d6bdd51fa4e1769678562de69929c38a0c4b))
* add support for non-strict formatters ([#1721](https://www.github.com/restify/node-restify/issues/1721)) ([de1833a](https://www.github.com/restify/node-restify/commit/de1833a44084e5f231de289421518ec646b86f60))
* jsonBodyParser handles extended content types *+json ([#1663](https://www.github.com/restify/node-restify/issues/1663)) ([4537514](https://www.github.com/restify/node-restify/commit/45375144feb6a215ebfdb967ff0944e3aa21f48d))
* **router:** add ignoreTrailingSlash router option ([#1632](https://www.github.com/restify/node-restify/issues/1632)) ([92ffbf5](https://www.github.com/restify/node-restify/commit/92ffbf5cbe49df09d9c59a6081285c12fe5943b4))
* **server:** new router and middleware system ([#1561](https://www.github.com/restify/node-restify/issues/1561)) ([8283277](https://www.github.com/restify/node-restify/commit/82832771826321480e5e524db258668f62b689c2))
* cpuUsageThrottle ([#1460](https://www.github.com/restify/node-restify/issues/1460)) ([84be679](https://www.github.com/restify/node-restify/commit/84be6799c4a80ae67f3aa03165c8031a55bddc97))
* **throttle plugin:** expose rate limit metrics as headers ([#1453](https://www.github.com/restify/node-restify/issues/1453)) ([1627a55](https://www.github.com/restify/node-restify/commit/1627a557bd4ed94ba1c6adbe916c51f83bc46059))
* create inflightRequestThrottle plugin ([#1431](https://www.github.com/restify/node-restify/issues/1431)) ([285faf4](https://www.github.com/restify/node-restify/commit/285faf4b6a2e56f0e4d9fc6dfaa3dd5e311530c1))
* revert async formatters ([#1377](https://www.github.com/restify/node-restify/issues/1377)) ([a2e300f](https://www.github.com/restify/node-restify/commit/a2e300f785edb087da9a52f562bd1f900e9ab47a))


### Bug Fixes

* add support for secureOptions in createServer ([#1575](https://www.github.com/restify/node-restify/issues/1575)) ([656e60e](https://www.github.com/restify/node-restify/commit/656e60e03d5fe2b011f8b2198178bc22d749b21f))
* Allow multiple unmerged set-cookie headers. ([#1570](https://www.github.com/restify/node-restify/issues/1570)) ([df04015](https://www.github.com/restify/node-restify/commit/df04015439becae8e8c48a02cb6e1992d6040037))
* Correct typo in assertion message ([#1904](https://www.github.com/restify/node-restify/issues/1904)) ([195cf13](https://www.github.com/restify/node-restify/commit/195cf136e3a7de2b2720261dfd459c051b5be037))
* documentation typo fix ([#1688](https://www.github.com/restify/node-restify/issues/1688)) ([0fa7132](https://www.github.com/restify/node-restify/commit/0fa71328b8f01f301b0e729f5ef0f00d1b203231))
* don't create empty clientError listener for http.Server ([#1895](https://www.github.com/restify/node-restify/issues/1895)) ([ddc1042](https://www.github.com/restify/node-restify/commit/ddc1042af427fe6383ebea37201c06b7b424e72f))
* emit after event with proper error param for node versions >= 11.4.0 ([#1732](https://www.github.com/restify/node-restify/issues/1732)) ([7a1378b](https://www.github.com/restify/node-restify/commit/7a1378b0353e9b3f1b630e4cab489c8c578000f5))
* examples/todoapp/package.json to reduce vulnerabilities ([#1832](https://www.github.com/restify/node-restify/issues/1832)) ([d9b27c6](https://www.github.com/restify/node-restify/commit/d9b27c602e260fc6c4f0e18e8b6835e89fa2adca))
* format falsy constants properly in json formatter ([#1792](https://www.github.com/restify/node-restify/issues/1792)) ([3002182](https://www.github.com/restify/node-restify/commit/3002182cacc7a9334237a9284a339ba93d3f213c))
* make arity error message actionable ([#1901](https://www.github.com/restify/node-restify/issues/1901)) ([97b6f93](https://www.github.com/restify/node-restify/commit/97b6f936e43860873f847bdd752b8090b3119da0))
* more flaky metrics.test.js fixes ([#1730](https://www.github.com/restify/node-restify/issues/1730)) ([71aac42](https://www.github.com/restify/node-restify/commit/71aac4283a1ae4ebd3c290afb83487b67010666f))
* properly handle non-errors thrown in domains ([#1757](https://www.github.com/restify/node-restify/issues/1757)) ([cb2e717](https://www.github.com/restify/node-restify/commit/cb2e7177c8b735987aed1c0839747f9658c19bb0))
* proxy events into instance var and add test script ([#1661](https://www.github.com/restify/node-restify/issues/1661)) ([de72f49](https://www.github.com/restify/node-restify/commit/de72f49eade48cc14dd916916ea86f88d46d3c8a))
* Re-add support for clientError listeners ([#1897](https://www.github.com/restify/node-restify/issues/1897)) ([05f12a6](https://www.github.com/restify/node-restify/commit/05f12a6864f4fa9aea617a42ae2d5c890478d2df))
* remove invalid triggering of uncaughtException handler ([#1710](https://www.github.com/restify/node-restify/issues/1710)) ([ee69806](https://www.github.com/restify/node-restify/commit/ee69806a338add1ebfef7eaad92a13273826c98e))
* Return 444 status code for closed and aborted requests ([#1579](https://www.github.com/restify/node-restify/issues/1579)) ([644c198](https://www.github.com/restify/node-restify/commit/644c1980aa1a21b0c7fa9aa41e22df9af6eab31e))
* send numbers or bools as payloads ([#1609](https://www.github.com/restify/node-restify/issues/1609)) ([0919f26](https://www.github.com/restify/node-restify/commit/0919f26db5d5614c0b2fa2567ac2ed43ee70b6d5))
* server should fire not acceptable event ([#1627](https://www.github.com/restify/node-restify/issues/1627)) ([8b11b71](https://www.github.com/restify/node-restify/commit/8b11b71b487d0001c96312519298f7f85b196471))
* use close event on response instead of socket ([#1892](https://www.github.com/restify/node-restify/issues/1892)) ([5c7eb95](https://www.github.com/restify/node-restify/commit/5c7eb95319aa54ef3b4b60d000d434824a666e18))
* use more reliable close event ([36318ae](https://www.github.com/restify/node-restify/commit/36318ae4c1fee02d3bc3737e34e1ea33e604f674))
* **benchmark:** force latest restify version ([#1810](https://www.github.com/restify/node-restify/issues/1810)) ([b8ec60e](https://www.github.com/restify/node-restify/commit/b8ec60e335b3ce95be4f2507623d357f4a600331))
* **bodyReader:** Fix memory leak ([#1566](https://www.github.com/restify/node-restify/issues/1566)) ([756b3f0](https://www.github.com/restify/node-restify/commit/756b3f02ba1dec114cf76c4e723ed054170a081c))
* **cpuUsageThrottle:** Always queue a new timeout ([#1484](https://www.github.com/restify/node-restify/issues/1484)) ([e4ffe43](https://www.github.com/restify/node-restify/commit/e4ffe430b47a2b51fe5fbef00dfa8bd3a1fb66c1))
* **cpuUsageThrottle:** Correctly named handler for debugInfo ([#1499](https://www.github.com/restify/node-restify/issues/1499)) ([78b0900](https://www.github.com/restify/node-restify/commit/78b0900b0ffcefa86e541c850d27779c5f656f00))
* **cpuUsageThrottle:** dont include interval in lag ([#1504](https://www.github.com/restify/node-restify/issues/1504)) ([eecb2d2](https://www.github.com/restify/node-restify/commit/eecb2d259deda34c2f297f2ef8b6d4fedc504e9e))
* **cpuUsageThrottle:** support breaking change in pidusage module ([7460064](https://www.github.com/restify/node-restify/commit/7460064fc13e5b977a295a2c939e050129c47797))
* **dev:** pin to exact versions of linting tools and fix lint errors ([3740a6b](https://www.github.com/restify/node-restify/commit/3740a6b7bf6e3bd589d9c1bc0c3d690978270564))
* **dev:** remove nsp since the project merged with npm ([1dc34b4](https://www.github.com/restify/node-restify/commit/1dc34b48de361960d7fa37d8bbc82b9d4a612981))
* **dev:** upgrading modules including restify-errors ([#1755](https://www.github.com/restify/node-restify/issues/1755)) ([3b71229](https://www.github.com/restify/node-restify/commit/3b712298c16577394d16b149be6c9a99044332b2))
* **dtrace:** route probes ([#1659](https://www.github.com/restify/node-restify/issues/1659)) ([84bcded](https://www.github.com/restify/node-restify/commit/84bcded77e9a42d3762146802418a1ae1ece8c30))
* **inflightRequestThrottle:** properly handle next ([#1471](https://www.github.com/restify/node-restify/issues/1471)) ([4db404f](https://www.github.com/restify/node-restify/commit/4db404f979d0da9651c00b076ceefb7b98a4e71f))
* **jsonBodyParser:** fix percent sign causing server fail ([#1411](https://www.github.com/restify/node-restify/issues/1411)) ([bde8fda](https://www.github.com/restify/node-restify/commit/bde8fda646a6f69b57fd72af1f00d6153fe056ec))
* **npm:** exclude extraneous files ([#1818](https://www.github.com/restify/node-restify/issues/1818)) ([e8516c3](https://www.github.com/restify/node-restify/commit/e8516c3735487ad5ebd332bc781404654c8c3cec))
* **npm:** remove unleash dependency ([#1522](https://www.github.com/restify/node-restify/issues/1522)) ([a43aa60](https://www.github.com/restify/node-restify/commit/a43aa60f090d29b8e66a58a9656126cb37bf2ef9))
* **package-lock.json:** remove artifacts.netflix.com repo ([#1526](https://www.github.com/restify/node-restify/issues/1526)) ([3d2f0f7](https://www.github.com/restify/node-restify/commit/3d2f0f7d0ddc14238691944cb9a1a60b02ae5947))
* **plugins:** save req._matchedVersion ([#1642](https://www.github.com/restify/node-restify/issues/1642)) ([69f917a](https://www.github.com/restify/node-restify/commit/69f917a3db66fac58f01c9e16535c2e2fcf2172b))
* **plugins:** use process.hrtime() for duration calculation ([#1507](https://www.github.com/restify/node-restify/issues/1507)) ([e8efd6c](https://www.github.com/restify/node-restify/commit/e8efd6cdcb73e674583e2a7081d2a9b923c72809))
* **request:** date() and time() methods return value ([#1576](https://www.github.com/restify/node-restify/issues/1576)) ([4c2cb1a](https://www.github.com/restify/node-restify/commit/4c2cb1a7edfe6252e68e409d850aef73961338ca))
* **server:** address domain performance regression with Node v12.x ([#1809](https://www.github.com/restify/node-restify/issues/1809)) ([e648d49](https://www.github.com/restify/node-restify/commit/e648d491151484f17263c6774678f1e7ac2fa188))
* **server:** address req and res close event changes in Node v10.x ([#1672](https://www.github.com/restify/node-restify/issues/1672)) ([6be3fb7](https://www.github.com/restify/node-restify/commit/6be3fb7c07483ee1991eba9aaa9ad4897c5a4965))
* **server:** avoid http2 experimental warning without http2 option ([#1555](https://www.github.com/restify/node-restify/issues/1555)) ([12da7fd](https://www.github.com/restify/node-restify/commit/12da7fdfc68dd9467da97ae0b2f45b89cb540b9b))
* **server:** avoiding uncaughtException in _routeErrorResponse by only sending response when not sent ([#1568](https://www.github.com/restify/node-restify/issues/1568)) ([cf65c65](https://www.github.com/restify/node-restify/commit/cf65c65cabd06bd5d17d84cd28999248dada94f7))
* **server:** fix uncaught exceptions triggering route lookups ([#1717](https://www.github.com/restify/node-restify/issues/1717)) ([e49cb3b](https://www.github.com/restify/node-restify/commit/e49cb3b24c3f4d77fa0b3204f3c1a618fb054789))
* **test:** make upgrade test pass ([#1772](https://www.github.com/restify/node-restify/issues/1772)) ([d30b748](https://www.github.com/restify/node-restify/commit/d30b7483c4d035e9a3fa94114557ae9d5f058f79))
* 652 - Incorrect error on route with no versions ([#1465](https://www.github.com/restify/node-restify/issues/1465)) ([ee15490](https://www.github.com/restify/node-restify/commit/ee154908d3ec4fd4a4108019140820c172df66b5))
* Add migration guid to website ([#1402](https://www.github.com/restify/node-restify/issues/1402)) ([5f053c7](https://www.github.com/restify/node-restify/commit/5f053c7efebc414b5a26daac3cc5e89dc0054fe3))
* add node 7-8 travis support ([#1405](https://www.github.com/restify/node-restify/issues/1405)) ([536a473](https://www.github.com/restify/node-restify/commit/536a4735266a7f56c205be4c6cafaa6adf81f480))
* create unit tests for sanitizePath plugin ([#1352](https://www.github.com/restify/node-restify/issues/1352)) ([12714cf](https://www.github.com/restify/node-restify/commit/12714cfce5048c65b4256df660766e863578b90a))
* doc site ([#1393](https://www.github.com/restify/node-restify/issues/1393)) ([76ee548](https://www.github.com/restify/node-restify/commit/76ee5480cfcb7f36e39e3e0955102c04abdac867))
* documentation update for restifyError event example ([#1398](https://www.github.com/restify/node-restify/issues/1398)) ([94fe715](https://www.github.com/restify/node-restify/commit/94fe715173ffcebd8814bed7e17a22a24fac4ae8))
* emit restifyError event even for router errors ([#1420](https://www.github.com/restify/node-restify/issues/1420)) ([f9d02d5](https://www.github.com/restify/node-restify/commit/f9d02d5b358863b9e067da5d6c89b4e283f420ba))
* redirect should work even when hostname or protocol is not specified in req.url ([#1497](https://www.github.com/restify/node-restify/issues/1497)) ([e696a1f](https://www.github.com/restify/node-restify/commit/e696a1f80cd84e7d3db9fb85a18212f970f9a0d3))
* **server:** error in pre handler triggers after event ([#1500](https://www.github.com/restify/node-restify/issues/1500)) ([c2e6dea](https://www.github.com/restify/node-restify/commit/c2e6deae5dab78187a8b09ce5256fb09db390bc9))
* exclude package-lock.json ([#1477](https://www.github.com/restify/node-restify/issues/1477)) ([011fdf0](https://www.github.com/restify/node-restify/commit/011fdf0e2e5b456fe18c9d2ef838819f52586c14))
* **static:** avoid user-provided data in Error messages being interpreted as sprintf codes ([#1384](https://www.github.com/restify/node-restify/issues/1384)) ([#1472](https://www.github.com/restify/node-restify/issues/1472)) ([9906344](https://www.github.com/restify/node-restify/commit/99063447419e7dcd0bf4ff6c38c5ad1867a2e1f3))
* audit timers of same name should accumulate ([#1435](https://www.github.com/restify/node-restify/issues/1435)) ([#1443](https://www.github.com/restify/node-restify/issues/1443)) ([a2d34aa](https://www.github.com/restify/node-restify/commit/a2d34aaa461cabf47147990a1c2910ea9a53b2d8))
* GH-1438, error reponse customization documentation incorrect ([#1439](https://www.github.com/restify/node-restify/issues/1439)) ([dd66088](https://www.github.com/restify/node-restify/commit/dd66088f3067d4b0858a2dd0274c705faf374e0e))
* Honor port for redirect ([#1363](https://www.github.com/restify/node-restify/issues/1363)) ([61c0cb5](https://www.github.com/restify/node-restify/commit/61c0cb5c697bcd84c2f7255bfe158619694fb73d))
* monkey patch getHeaders for pre-v7 Node.js (GH-1409) ([82088a7](https://www.github.com/restify/node-restify/commit/82088a7185331c7de092450ffec52d815c079739))
* package.json version now matches npm ([9944dbd](https://www.github.com/restify/node-restify/commit/9944dbd57795fa312c8f35c4734977698d70c895))
* respect when status code is set with res.status (GH-1429) ([#1440](https://www.github.com/restify/node-restify/issues/1440)) ([5abc067](https://www.github.com/restify/node-restify/commit/5abc06779df3b3ed4faf4d19f0815051a7c3106b))
* test static plugin's handling of sprintf escape sequences ([#1391](https://www.github.com/restify/node-restify/issues/1391)) ([5d7039a](https://www.github.com/restify/node-restify/commit/5d7039a5b97e158347fbb918b866b7aeebd4a14f))
* update chai (^3.4.1 to ^4.0.0) ([f982d0c](https://www.github.com/restify/node-restify/commit/f982d0c71f1b72f79e07f33f6cdf43741242f5d8))
* Update dependency mime to 1.4.0 ([#1467](https://www.github.com/restify/node-restify/issues/1467)) ([6d38b38](https://www.github.com/restify/node-restify/commit/6d38b38c7a67e9b7cb8500fd1a92751e5ea4ee38))
* update http-signature to v1.0.0 ([#1401](https://www.github.com/restify/node-restify/issues/1401)) ([ec88737](https://www.github.com/restify/node-restify/commit/ec887376a8314edbb623db48e6288d5a352a4efd))
* use `Buffer.isBuffer` instead of `util.isBuffer`. ([#1593](https://www.github.com/restify/node-restify/issues/1593)) ([35bd1c2](https://www.github.com/restify/node-restify/commit/35bd1c2b375ea70dc2b4a4549461ff59ff5e4ec4))
* versioned route matching should not throw TypeError ([#1381](https://www.github.com/restify/node-restify/issues/1381)) ([25d10f0](https://www.github.com/restify/node-restify/commit/25d10f00a4c9128b87cda0261aa3a041ac652f63))
* **audit:** use public APIs for accessing response headers ([5169db7](https://www.github.com/restify/node-restify/commit/5169db7b1d2c9979e534b2c27912f5be398bcbca)), closes [/nodejs.org/api/deprecations.html#deprecations_dep0066](https://www.github.com/restify//nodejs.org/api/deprecations.html/issues/deprecations_dep0066)


* Prefer Pino logger over Bunyan (#1841) ([2f5bf87](https://www.github.com/restify/node-restify/commit/2f5bf8722c9e0ba0d45f32af5c2c16ddbaa538b4)), closes [#1841](https://www.github.com/restify/node-restify/issues/1841)


### Miscellaneous Chores

* drop support for node 8 ([bd34988](https://www.github.com/restify/node-restify/commit/bd349884321d3e8af549f4d9da4456774e82ac8b))
* remove deprecated usage of pino.child ([#1902](https://www.github.com/restify/node-restify/issues/1902)) ([0a8cf83](https://www.github.com/restify/node-restify/commit/0a8cf8345de26f8ee98e87c0085f0f9439302d98))
* **travisci:** revisit nodejs version. Change to: LTS active, LTS maintenance (4.x) and stable releases ([#1553](https://www.github.com/restify/node-restify/issues/1553)) ([49eb008](https://www.github.com/restify/node-restify/commit/49eb008d987f1c425989b78e2336e3583e05a88a))

## [11.1.0](https://github.com/restify/node-restify/compare/v11.0.0...v11.1.0) (2023-02-24)


### Features

* allow custom alternatives to domains ([54adfcb](https://github.com/restify/node-restify/commit/54adfcbdea1a6be3675dbc05573f8063fc16a05b))

## [11.0.0](https://github.com/restify/node-restify/compare/v10.0.0...v11.0.0) (2023-01-17)


### ⚠ BREAKING CHANGES

* don't override req.log if set during .first
* use req.log on audit plugin

### Features

* don't override req.log if set during .first ([852d2c1](https://github.com/restify/node-restify/commit/852d2c153d1815274db8cdd7799625e9740090b3))
* use req.log on audit plugin ([528ecbc](https://github.com/restify/node-restify/commit/528ecbcec5d70c458749bdd4c4cc3f9e06ab69a2))

## [10.0.0](https://github.com/restify/node-restify/compare/v9.0.0...v10.0.0) (2022-11-29)


### ⚠ BREAKING CHANGES

* support v18.x

### Features

* bump dtrace-provider version to avoid MacOS errors ([fa52f60](https://github.com/restify/node-restify/commit/fa52f60d85c3df8a1babde98be184bb918958ef3))
* support v18.x ([5795223](https://github.com/restify/node-restify/commit/57952239fa1808a6cf6e70deb2754c4c85c1be39))

### 8.5.1 (2019-12-13)


#### Bug Fixes

* **benchmark:** force latest restify version (#1810) ([b8ec60e3](git://github.com/restify/node-restify.git/commit/b8ec60e3))
* **server:** address domain performance regression with Node v12.x (#1809) ([e648d491](git://github.com/restify/node-restify.git/commit/e648d491))


<a name="8.5.0"></a>
## 8.5.0 (2019-12-02)


#### Features

* **chain:** use nextTick instead of setImmediate (#1808) ([703470ad](git://github.com/restify/node-restify.git/commit/703470ad))


<a name="8.4.1"></a>
### 8.4.1 (2019-11-27)


<a name="8.4.0"></a>
## 8.4.0 (2019-07-31)


#### Features

* **chain:** schedule handlers to the next tick (#1798) ([806ed711](git://github.com/restify/node-restify.git/commit/806ed711))


<a name="8.3.3"></a>
### 8.3.3 (2019-06-04)


<a name="8.3.2"></a>
### 8.3.2 (2019-05-06)


<a name="8.3.1"></a>
### 8.3.1 (2019-04-25)


#### Bug Fixes

* **test:** make upgrade test pass (#1772) ([d30b7483](git://github.com/restify/node-restify.git/commit/d30b7483))


<a name="8.3.0"></a>
## 8.3.0 (2019-04-11)


#### Features

* provide callback to uncaughtException handler (#1766) ([5e8b5e2b](git://github.com/restify/node-restify.git/commit/5e8b5e2b))


<a name="8.2.0"></a>
## 8.2.0 (2019-03-18)


#### Bug Fixes

* properly handle non-errors thrown in domains (#1757) ([cb2e7177](git://github.com/restify/node-restify.git/commit/cb2e7177))
* **cpuUsageThrottle:** support breaking change in pidusage module ([7460064f](git://github.com/restify/node-restify.git/commit/7460064f))


#### Features

* **first:** Handlers that execute ASAP in the req/res lifecycle (#1756) ([8178098d](git://github.com/restify/node-restify.git/commit/8178098d))


<a name="8.1.1"></a>
### 8.1.1 (2019-03-14)

#### Bug Fixes

* Published NPM package had a bad dependency on `npm` causing new irrelevant packages to get installed

<a name="8.1.0"></a>
## 8.1.0 (2019-03-06)


#### Bug Fixes

* **dev:** upgrading modules including restify-errors (#1755) ([3b712298](git://github.com/restify/node-restify.git/commit/3b712298))


#### Features

* add router.render() back to support hypermedia usecase (#1752) ([0700cfd4](git://github.com/restify/node-restify.git/commit/0700cfd4), closes [#1684](git://github.com/restify/node-restify.git/issues/1684))
* **plugin:** plugin to serve static files (#1753) ([a67b25f4](git://github.com/restify/node-restify.git/commit/a67b25f4))


<a name="8.0.0"></a>
## 8.0.0 (2019-02-20)
#### Breaking Changes

* Dropped Support for Node v4.x and Node v6.x


<a name="7.7.0"></a>
## 7.7.0 (2019-02-01)


#### Bug Fixes

* **dev:**
  * remove nsp since the project merged with npm ([1dc34b48](git://github.com/restify/node-restify.git/commit/1dc34b48))
  * pin to exact versions of linting tools and fix lint errors ([3740a6b7](git://github.com/restify/node-restify.git/commit/3740a6b7))


#### Features

* **audit:** Add the ability to specify a custom audit log serializer (for err, req and res)  ([6231acda](git://github.com/restify/node-restify.git/commit/6231acda))


<a name="7.6.0"></a>
## 7.6.0 (2019-01-18)


#### Features

* **req:** add restifyDone event (#1740) ([4900d6bd](git://github.com/restify/node-restify.git/commit/4900d6bd))


<a name="7.5.0"></a>
## 7.5.0 (2019-01-09)


#### Bug Fixes

* emit after event with proper error param for node versions >= 11.4.0 (#1732) ([7a1378b0](git://github.com/restify/node-restify.git/commit/7a1378b0))


#### Features

* **plugins:** context, req.get() returns the whole context (#1739) ([6e35e01e](git://github.com/restify/node-restify.git/commit/6e35e01e))


<a name="7.4.0"></a>
## 7.4.0 (2019-01-02)


#### Bug Fixes

* more flaky metrics.test.js fixes (#1730) ([71aac428](git://github.com/restify/node-restify.git/commit/71aac428))


#### Features

* **plugins:** do not include user-input in UnsupportedMediaTypeError message (VError fails), m ([06c220d2](git://github.com/restify/node-restify.git/commit/06c220d2))


<a name="7.3.0"></a>
## 7.3.0 (2018-12-07)


#### Features

* add support for non-strict formatters (#1721) ([de1833a4](git://github.com/restify/node-restify.git/commit/de1833a4))


<a name="7.2.3"></a>
### 7.2.3 (2018-11-16)


#### Bug Fixes

* **server:** fix uncaught exceptions triggering route lookups (#1717) ([e49cb3b2](git://github.com/restify/node-restify.git/commit/e49cb3b2))


<a name="7.2.2"></a>
### 7.2.2 (2018-10-29)


#### Bug Fixes

* documentation typo fix (#1688) ([0fa71328](git://github.com/restify/node-restify.git/commit/0fa71328))


<a name="7.2.1"></a>
### 7.2.1 (2018-06-07)


#### Bug Fixes

* proxy events into instance var and add test script (#1661) ([de72f49e](git://github.com/restify/node-restify.git/commit/de72f49e))
* **server:** address req and res close event changes in Node v10.x (#1672) ([6be3fb7c](git://github.com/restify/node-restify.git/commit/6be3fb7c))


#### Features

* jsonBodyParser handles extended content types *+json (#1663) ([45375144](git://github.com/restify/node-restify.git/commit/45375144))


<a name="7.2.0"></a>
## 7.2.0 (2018-05-16)


#### Features

* **helpers:** add compose feature (#1660) ([eb60ef40](git://github.com/restify/node-restify.git/commit/eb60ef40))


<a name="7.1.2"></a>
### 7.1.2 (2018-05-15)


#### Bug Fixes

* **dtrace:** route probes (#1659) ([84bcded7](git://github.com/restify/node-restify.git/commit/84bcded7))


<a name="7.1.1"></a>
### 7.1.1 (2018-04-10)


#### Bug Fixes

* **plugins:** save req._matchedVersion (#1642) ([69f917a3](git://github.com/restify/node-restify.git/commit/69f917a3))


<a name="7.1.0"></a>
## 7.1.0 (2018-03-26)


#### Features

* **router:** add ignoreTrailingSlash router option (#1632) ([92ffbf5c](git://github.com/restify/node-restify.git/commit/92ffbf5c))


<a name="7.0.0"></a>
## 7.0.0 (2018-03-20)


#### Features

* **server:** new router and middleware system (#1561) ([1161370b](git://github.com/restify/node-restify.git/commit/1161370b))


#### Breaking Changes

*
- Server returns `RequestCloseError` instead of `RequestAbortedError`
- Non-strict routing is gone
- Different `RegExp` usage in router path and wildcards
- Remove already deprecated `next.ifError`
- Disable DTrace probes by default
- Change in calling `next` multiple times
- Router versioning and content type as a separate plugin: `conditionalHandler`
- After event fires when both request is flushed and the last handler is finished
- Metrics plugin latency logic changes and new latencies were added

For more info see the `/guides/6to7guide.md`.
 ([1161370b](git://github.com/restify/node-restify.git/commit/1161370b))
* dropping support below Node.js 4
 ([0698f45c](git://github.com/restify/node-restify.git/commit/0698f45c))


<a name="6.4.0"></a>
## 6.4.0 (2018-03-20)


#### Bug Fixes

* server should fire not acceptable event (#1627) ([8b11b71b](git://github.com/restify/node-restify.git/commit/8b11b71b))
* send numbers or bools as payloads (#1609) ([0919f26d](git://github.com/restify/node-restify.git/commit/0919f26d))
* Allow multiple unmerged set-cookie headers. (#1570) ([df040154](git://github.com/restify/node-restify.git/commit/df040154))
* add support for secureOptions in createServer (#1575) ([656e60e0](git://github.com/restify/node-restify.git/commit/656e60e0))
* use `Buffer.isBuffer` instead of `util.isBuffer`. (#1593) ([35bd1c2b](git://github.com/restify/node-restify.git/commit/35bd1c2b))
* **jsonBodyParser:** fix percent sign causing server fail (#1411) ([bde8fda6](git://github.com/restify/node-restify.git/commit/bde8fda6))
* **request:** date() and time() methods return value (#1576) ([4c2cb1a7](git://github.com/restify/node-restify.git/commit/4c2cb1a7))


<a name="6.3.4"></a>
### 6.3.4 (2017-11-21)


#### Bug Fixes

* **bodyReader:** Fix memory leak (#1566) ([756b3f02](git://github.com/restify/node-restify.git/commit/756b3f02))
* **server:** avoiding uncaughtException in _routeErrorResponse by only sending response when  ([cf65c65c](git://github.com/restify/node-restify.git/commit/cf65c65c))


<a name="6.3.2"></a>
### 6.3.2 (2017-11-08)


<a name="6.3.1"></a>
### 6.3.1 (2017-11-03)


#### Bug Fixes

* **server:** avoid http2 experimental warning without http2 option (#1555) ([12da7fdf](git://github.com/restify/node-restify.git/commit/12da7fdf))


<a name="6.3.0"></a>
## 6.3.0 (2017-11-02)


#### Features

* **http2:** add native HTTP/2 support (#1489) ([6b202853](git://github.com/restify/node-restify.git/commit/6b202853))


<a name="6.2.3"></a>
### 6.2.3 (2017-10-18)


<a name="6.2.2"></a>
### 6.2.2 (2017-10-18)


#### Bug Fixes

* **package-lock.json:** remove artifacts.netflix.com repo (#1526) ([3d2f0f7d](git://github.com/restify/node-restify.git/commit/3d2f0f7d))


<a name="6.2.1"></a>
### 6.2.1 (2017-10-18)


#### Bug Fixes

* **cpuUsageThrottle:** dont include interval in lag (#1504) ([eecb2d25](git://github.com/restify/node-restify.git/commit/eecb2d25))
* **npm:** remove unleash dependency (#1522) ([a43aa60f](git://github.com/restify/node-restify.git/commit/a43aa60f))
* **plugins:** use process.hrtime() for duration calculation (#1507) ([e8efd6cd](git://github.com/restify/node-restify.git/commit/e8efd6cd))


<a name="6.2.0"></a>
## 6.2.0 (2017-10-16)


#### Bug Fixes

* **cpuUsageThrottle:** dont include interval in lag (#1504) ([eecb2d25](git://github.com/restify/node-restify.git/commit/eecb2d25))
* **plugins:** use process.hrtime() for duration calculation (#1507) ([e8efd6cd](git://github.com/restify/node-restify.git/commit/e8efd6cd))


<a name="6.1.0"></a>
## 6.1.0 (2017-10-16)


#### Bug Fixes

* **cpuUsageThrottle:** dont include interval in lag (#1504) ([eecb2d25](git://github.com/restify/node-restify.git/commit/eecb2d25))
* **plugins:** use process.hrtime() for duration calculation (#1507) ([e8efd6cd](git://github.com/restify/node-restify.git/commit/e8efd6cd))


<a name="6.0.1"></a>
### 6.0.1 (2017-09-19)


#### Bug Fixes

* **cpuUsageThrottle:** Correctly named handler for debugInfo (#1499) ([78b0900b](git://github.com/restify/node-restify.git/commit/78b0900b))
* **server:** error in pre handler triggers after event (#1500) ([c2e6deae](git://github.com/restify/node-restify.git/commit/c2e6deae))


<a name="6.0.0"></a>
## 6.0.0 (2017-09-15)


#### Bug Fixes

* exclude package-lock.json (#1477) ([011fdf0e](git://github.com/restify/node-restify.git/commit/011fdf0e))
* Update dependency mime to 1.4.0 (#1467) ([6d38b38c](git://github.com/restify/node-restify.git/commit/6d38b38c))
* **cpuUsageThrottle:** Always queue a new timeout (#1484) ([e4ffe430](git://github.com/restify/node-restify.git/commit/e4ffe430))
* **inflightRequestThrottle:** properly handle next (#1471) ([4db404f9](git://github.com/restify/node-restify.git/commit/4db404f9))
* **static:** avoid user-provided data in Error messages being interpreted as sprintf codes (# ([99063447](git://github.com/restify/node-restify.git/commit/99063447))


#### Features

* cpuUsageThrottle (#1460) ([84be6799](git://github.com/restify/node-restify.git/commit/84be6799))
* **throttle plugin:** expose rate limit metrics as headers (#1453) ([1627a557](git://github.com/restify/node-restify.git/commit/1627a557))


<a name="5.2.0"></a>
## 5.2.0 (2017-08-16)


#### Bug Fixes

* package.json version now matches npm ([9944dbd5](git://github.com/restify/node-restify.git/commit/9944dbd5))
* create unit tests for sanitizePath plugin (#1352) ([12714cfc](git://github.com/restify/node-restify.git/commit/12714cfc))
* audit timers of same name should accumulate (#1435) (#1443) ([a2d34aaa](git://github.com/restify/node-restify.git/commit/a2d34aaa))
* respect when status code is set with res.status (GH-1429) (#1440) ([5abc0677](git://github.com/restify/node-restify.git/commit/5abc0677))
* versioned route matching should not throw TypeError (#1381) ([25d10f00](git://github.com/restify/node-restify.git/commit/25d10f00))


<a name="5.0.1"></a>
### 5.0.1 (2017-07-17)


#### Bug Fixes

* monkey patch getHeaders for pre-v7 Node.js (GH-1409) ([82088a71](git://github.com/restify/node-restify.git/commit/82088a71))
* add node 7-8 travis support (#1405) ([536a4735](git://github.com/restify/node-restify.git/commit/536a4735))
* Add migration guid to website (#1402) ([5f053c7e](git://github.com/restify/node-restify.git/commit/5f053c7e))
* update http-signature to v1.0.0 (#1401) ([ec887376](git://github.com/restify/node-restify.git/commit/ec887376))
* documentation update for restifyError event example (#1398) ([94fe7151](git://github.com/restify/node-restify.git/commit/94fe7151))
* doc site (#1393) ([76ee5480](git://github.com/restify/node-restify.git/commit/76ee5480))
* test static plugin's handling of sprintf escape sequences (#1391) ([5d7039a5](git://github.com/restify/node-restify.git/commit/5d7039a5))
