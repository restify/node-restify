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

