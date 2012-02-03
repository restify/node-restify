ifeq ($(VERSION), "")
	@echo "Use gmake"
endif

# Globals

DOCPKGDIR = ./docs/pkg
NAME=restify
SRC := $(shell pwd)
RESTDOWN_VERSION=1.2.15

# Commands

MAKE = make
TAR = tar
UNAME := $(shell uname)
ifeq ($(UNAME), SunOS)
	MAKE = gmake
	TAR = gtar
endif

NPM := npm_config_tar=$(TAR) npm

LINT = ./node_modules/.javascriptlint/build/install/jsl --conf ./tools/jsl.conf
RELEASE = python ./node_modules/.cutarelease/cutarelease.py -f package.json
RESTDOWN = ./node_modules/.restdown/bin/restdown \
	-m ${DOCPKGDIR} \
	-D mediaroot=media
#	-b ./docs/branding \

TAP = ./node_modules/.bin/tap

# Targets

.PHONY:  all clean cover doc distclean install lint install setup test

all:: test

node_modules/.npm.installed:
	$(NPM) install

	if [[ ! -d node_modules/.restdown ]]; then \
		git clone git://github.com/trentm/restdown.git node_modules/.restdown; \
	else \
		(cd node_modules/.restdown && git fetch origin); \
	fi

	if [[ ! -d node_modules/.javascriptlint ]]; then \
		git clone https://github.com/davepacheco/javascriptlint node_modules/.javascriptlint; \
	else \
		(cd node_modules/.javascriptlint && git fetch origin); \
	fi

	if [[ ! -d node_modules/.cutarelease ]]; then \
		git clone https://github.com/trentm/cutarelease node_modules/.cutarelease; \
	fi

	@(cd ./node_modules/.restdown && git checkout $(RESTDOWN_VERSION))
	@(cd ./node_modules/.javascriptlint && $(MAKE) install)
	@touch ./node_modules/.npm.installed

dep:	./node_modules/.npm.installed
install: dep
setup: dep

lint:
	${LINT} lib/*.js lib/plugins/*.js tst/*.js


doc: dep
	@rm -rf ${DOCPKGDIR}
	@mkdir -p ${DOCPKGDIR}
	${RESTDOWN} ./docs/guide.md
	rm docs/*.json
	mv docs/*.html ${DOCPKGDIR}
	(cd ${DOCPKGDIR} && $(TAR) -czf ${SRC}/${NAME}-docs-`git log -1 --pretty='format:%h'`.tar.gz *)

cover: install
	(TAP_COV=1 $(TAP) ./tst/*.test.js --cover=./lib --cover-dir=./coverage)

test: install
	$(NPM) test

clean:
	@rm -fr ${DOCPKGDIR} coverage *.log *.tar.gz

distclean: clean
	@rm -fr node_modules

release: lint test doc
	$(RELEASE)
	git checkout gh-pages
	git pull --rebase
	cp -r docs/pkg/* v1.0
	git add v1.0
	git commit -m 'release docs'
	git push origin gh-pages
	git checkout master
