NAME=node-restify

ifeq ($(VERSION), "")
	@echo "Use gmake"
endif


LINT = jshint
LINT_ARGS =
GLINT = gjslint
# Skip the files that have > 80 columns that aren't fixable
GLINT_ARGS = --nojsdoc -x lib/sprintf.js -e node_modules -r .

NODEUNIT = nodeunit

.PHONY: check test clean all

all:: check test

clean:

check:: lint glint

glint:
	${GLINT} ${GLINT_ARGS}

lint:
	${LINT} ${LINT_ARGS} lib/*.js
	${LINT} ${LINT_ARGS} tst/*.js

test:
	${NODEUNIT} tst
