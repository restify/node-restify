ifeq ($(VERSION), "")
	@echo "Use gmake"
endif

# Globals

DOCPKGDIR = ./docs/pkg
NAME=restify
SRC := $(shell pwd)
RESTDOWN_VERSION=1.2.13

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

RESTDOWN = ./node_modules/.restdown/bin/restdown \
	-b ./docs/branding \
	-m ${DOCPKGDIR} \
	-D mediaroot=media

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

	@(cd ./node_modules/.restdown && git checkout $(RESTDOWN_VERSION))
	@(cd ./node_modules/.javascriptlint && $(MAKE) install)
	@touch ./node_modules/.npm.installed

dep:	./node_modules/.npm.installed
install: dep
setup: dep

# gjslint:
# 	gjslint --nojsdoc -r lib -r tst

# ifeq ($(HAVE_GJSLINT), yes)
# lint: gjslint
# else
# lint:
# 	@echo "* * *"
# 	@echo "* Warning: Cannot lint with gjslint. Install it from:"
# 	@echo "*    http://code.google.com/closure/utilities/docs/linter_howto.html"
# 	@echo "* * *"
# endif

lint:
	${LINT} lib/*.js


doc: dep
	@rm -rf ${DOCPKGDIR}
	@mkdir -p ${DOCPKGDIR}
	# ${RESTDOWN} ./docs/client.md
	# ${RESTDOWN} ./docs/dn.md
	# ${RESTDOWN} ./docs/errors.md
	# ${RESTDOWN} ./docs/examples.md
	# ${RESTDOWN} ./docs/filters.md
	# ${RESTDOWN} ./docs/guide.md
	# ${RESTDOWN} ./docs/index.md
	# ${RESTDOWN} ./docs/server.md
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
