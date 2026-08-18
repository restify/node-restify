# Contributing to Restify

Welcome to the restify community! This document is written both for maintainers and community members!

## Issues and PRs

### Commit Messages

When merging a PR, we squash and merge to keep our commit history clean. Our commit messages use the conventional changelog format (http://conventionalcommits.org/) to automagically manage semver for us.

### Labels and Templates

We try to keep things organized around here. Maintainers have a finite amount of time and are often juggling multiple things in their lives. Keeping things consistent and well labeled helps reduce the amount of concentration and effort required for us to both find and carry out work on the project. Simple things like using our templates and adding the appropriate labels may only take you a few minutes, but it can save cummulative hours worth of work for maintainers trying to digest dozens of issues.

## Website

### Design

The website templates are maintained at https://github.com/restify/restify.github.io and are populated from the docs directory in this repo.

### Releasing a change

To update the documentaiton on the website to reflect the latest version of 5.x simply:

```
git clone --recursive git@github.com:restify/restify.github.io
cd restify.github.io
git submodule update --remote && git add _docs && git commit -m 'bump' && git push origin master
```

The website will automatically deploy itself with the new changes.

### Updating a documentation page

To update docs, simply run:  

```
make docs-build
```

### Adding a documentation page

To add a new page, simply give it a [permalink](https://github.com/restify/node-restify/blob/94fe715173ffcebd8814bed7e17a22a24fac4ae8/docs/index.md) and then update [docs.yml](https://github.com/restify/restify.github.io/blob/master/_data/docs.yml) with the new permalink.

## Running a benchmark

```
make benchmark
```

## Cutting a release

Releases are automated with [release-please](https://github.com/googleapis/release-please) and published to npm via GitHub Actions. We use [Conventional Commits](http://conventionalcommits.org/) to simplify the process of managing semver on this project — release-please parses commit types (`fix`, `feat`, etc.) to determine the version bump.

### Release flow

1. Merge pull requests to `master` using [Conventional Commits](http://conventionalcommits.org/).
2. `release-please` opens or updates a **Release PR** with the version bump and changelog.
3. Review and merge the Release PR when ready to ship.
4. `release-please` creates a GitHub Release and version tag (for example `v11.3.0`).
5. The `npm-publish` workflow runs automatically, re-runs tests, validates the package contents (`npm pack --dry-run`), then pauses at the `Publish` environment for reviewer approval.
6. After approval, the package is published to npm via [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC). Do not run `npm publish` manually.

### Dry run

To validate the publish workflow without publishing, run **Actions → npm-publish → Run workflow**. This runs tests and `npm pack --dry-run`.

### Retrying a failed run

If `npm-publish` fails, use **Re-run jobs** on the failed run itself (Actions tab) — it replays the same release/tag, so there's no need to cut a new one. This is safe even if `publish` partially ran, since `validate` checks whether the version is already on npm before continuing. 
