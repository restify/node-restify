NAME=node-restify

ifeq ($(VERSION), "")
	@echo "Use gmake"
endif


LINT = jshint
LINT_ARGS =
GLINT = gjslint
# Skip the files that have > 80 columns that aren't fixable
GLINT_ARGS = --nojsdoc -x lib/sprintf.js -e node_modules -r .

.PHONY: check test clean all docs

all:: glint test docs

docs:
	(cd docs && ls *.md | xargs ronn --style screen,toc)

clean:
	rm -fr docs/*.3* docs/*.7*

check:: lint glint

glint:
	${GLINT} ${GLINT_ARGS}

lint:
	${LINT} ${LINT_ARGS} lib/*.js
	${LINT} ${LINT_ARGS} tst/*.js

test:
	npm test
