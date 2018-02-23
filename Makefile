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
DOCUMENTATION		:= ./node_modules/.bin/documentation
NSP		:= ./node_modules/.bin/nsp
NODEUNIT	:= ./node_modules/.bin/nodeunit
MOCHA		:= ./node_modules/.bin/mocha
NODECOVER	:= ./node_modules/.bin/cover
DOCS_BUILD	:= ./tools/docsBuild.js
NPM		:= npm
NODE		:= node
PRETTIER		:= ./node_modules/.bin/prettier

#
# Files
#
JS_FILES	 = '.'

CLEAN_FILES	+= node_modules cscope.files

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

.PHONY: cover
cover: $(NODECOVER)
	@rm -fr ./.coverage_data
	$(NODECOVER) run $(NODEUNIT) ./test/*.js
	$(NODECOVER) report html

CLEAN_FILES += $(TAP) ./node_modules/nodeunit

.PHONY: test
test: $(NODEUNIT)
	$(NODEUNIT) test/*.test.js
	$(MOCHA) test/plugins/*.test.js

.PHONY: nsp
nsp: node_modules $(NSP)
	@($(NSP) check) | true

.PHONY: docs-build
docs-build:
	@($(NODE) $(DOCS_BUILD))

.PHONY: benchmark
benchmark:
	@(cd ./benchmark && $(NPM) i && $(NODE) index.js)

include ./tools/mk/Makefile.deps
include ./tools/mk/Makefile.targ
