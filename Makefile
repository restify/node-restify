#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#
# Makefile: basic Makefile for restify
#

#
# Tools
#
NPM		:= $(shell which npm)
TAP		:= ./node_modules/.bin/tap

#
# Files
#
DOC_FILES	 = guide.restdown
JS_FILES	:= $(shell find lib test -name '*.js')
JSL_CONF_NODE	 = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS    = -f tools/jsstyle.conf

#
# Repo-specific targets
#
.PHONY: all
all: test check

.PHONY: release
release: prepush $(CUTARELEASE)
	python $(CUTARELEASE) -f package.json

.PHONY: setup
setup: $(NPM)
	$(NPM) install

.PHONY: test
test: setup $(TAP)
	$(TAP) test/*.test.js

.PHONY: cutarelease
cutarelease:
	./deps/cutarelease/cutarelease.py -v -p restify -f package.json


include ./Makefile.deps
include ./Makefile.targ
