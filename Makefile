#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#
# Makefile: basic Makefile for template API service
#
# This Makefile is a template for new repos. It contains only repo-specific
# logic and uses included makefiles to supply common targets (javascriptlint,
# jsstyle, restdown, etc.), which are used by other repos as well. You may well
# need to rewrite most of this file, but you shouldn't need to touch the
# included makefiles.
#
# If you find yourself adding support for new targets that could be useful for
# other projects too, you should add these to the original versions of the
# included Makefiles (in eng.git) so that other teams can use them too.
#

#
# Tools
#
ESLINT		:= ./node_modules/.bin/eslint
JSCS		:= ./node_modules/.bin/jscs
NODEUNIT	:= ./node_modules/.bin/nodeunit
NODECOVER	:= ./node_modules/.bin/cover
NPM		:= npm
JSON		:= ./node_modules/.bin/json

#
# Files
#
DOC_FILES	 = index.restdown
JS_FILES	 = '.'
SHRINKWRAP	 = npm-shrinkwrap.json

CLEAN_FILES	+= node_modules $(SHRINKWRAP) cscope.files

include ./tools/mk/Makefile.defs

#
# Repo-specific targets
#
.PHONY: all
all: $(NODEUNIT) $(REPO_DEPS)
	$(NPM) rebuild

$(NODEUNIT): | $(NPM_EXEC)
	$(NPM) install

$(NODECOVER): | $(NPM_EXEC)
	$(NPM) install

$(JSON): | $(NPM_EXEC)
	$(NPM) install

.PHONY: cover
cover: $(NODECOVER)
	@rm -fr ./.coverage_data
	$(NODECOVER) run $(NODEUNIT) test/*.test.js
	$(NODECOVER) report html

CLEAN_FILES += $(TAP) ./node_modules/nodeunit

.PHONY: test
test: $(NODEUNIT)
	$(NODEUNIT) test/*.test.js

# Ensure CHANGES.md and package.json have the same version after a
# "## not yet released" section intended for unreleased changes.
.PHONY: versioncheck
versioncheck: | $(JSON)
	@echo version is: $(shell cat package.json | $(JSON) version)
	[ `cat package.json | $(JSON) version` \
	    = `grep '^## ' CHANGES.md | head -2 | tail -1 | awk '{print $$2}'` ]

# Confirm, then tag and publish the current version.
.PHONY: cutarelease
cutarelease: versioncheck
	[ -z "`git status --short`" ]  # If this fails, the working dir is dirty.
	@ver=$(shell $(JSON) -f package.json version) && \
	    name=$(shell $(JSON) -f package.json name) && \
	    publishedVer=$(shell npm view -j $(shell $(JSON) -f package.json name)@$(shell $(JSON) -f package.json version) version 2>/dev/null) && \
	    if [ -n "$$publishedVer" ]; then \
		echo "error: $$name@$$ver is already published to npm"; \
		exit 1; \
	    fi && \
	    echo "** Are you sure you want to tag and publish $$name@$$ver to npm?" && \
	    echo "** Enter to continue, Ctrl+C to abort." && \
	    read _cutarelease_confirm
	ver=$(shell cat package.json | $(JSON) version) && \
	    majorVer=$(shell cat package.json | $(JSON) version | cut -d. -f1) && \
	    date=$(shell date -u "+%Y-%m-%d") && \
	    git tag -a "v$$ver" -m "version $$ver ($$date)" && \
	    git push --tags origin && \
	    npm publish --tag=latest-$$majorVer

include ./tools/mk/Makefile.deps
include ./tools/mk/Makefile.targ
