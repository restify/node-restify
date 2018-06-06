#
# Directories
#
ROOT_SLASH	:= $(dir $(realpath $(firstword $(MAKEFILE_LIST))))
ROOT		:= $(patsubst %/,%,$(ROOT_SLASH))
TEST		:= $(ROOT)/test
TOOLS		:= $(ROOT)/tools
GITHOOKS_SRC	:= $(TOOLS)/githooks
GITHOOKS_DEST	:= $(ROOT)/.git/hooks


#
# Generated Files & Directories
#
NODE_MODULES	:= $(ROOT)/node_modules
NODE_BIN	:= $(NODE_MODULES)/.bin
COVERAGE	:= $(ROOT)/.nyc_output
COVERAGE_RES	:= $(ROOT)/coverage
PACKAGE_LOCK	:= $(ROOT)/package-lock.json
LCOV		:= $(COVERAGE)/lcov.info


#
# Tools and binaries
#
NPM		:= npm
COVERALLS	:= $(NODE_BIN)/coveralls
ESLINT		:= $(NODE_BIN)/eslint
MOCHA		:= $(NODE_BIN)/mocha
NODEUNIT	:= $(NODE_BIN)/nodeunit
NYC		:= $(NODE_BIN)/nyc
PRETTIER	:= $(NODE_BIN)/prettier
DOCS_BUILD	:= $(TOOLS)/docsBuild.js


#
# Files and globs
#
PACKAGE_JSON	:= $(ROOT)/package.json
GITHOOKS	:= $(wildcard $(GITHOOKS_SRC)/*)
ALL_FILES	:= $(shell find $(ROOT) \
			-not \( -path $(NODE_MODULES) -prune \) \
			-not \( -path $(COVERAGE) -prune \) \
			-not \( -path $(COVERAGE_RES) -prune \) \
			-name '*.js' -type f)
TEST_FILES	:= $(shell find $(TEST) -name '*.js' -type f)

#
# Targets
#

$(NODE_MODULES): $(PACKAGE_JSON) ## Install node_modules
	@$(NPM) install
	@touch $(NODE_MODULES)


.PHONY: help
help:
	@perl -nle'print $& if m{^[a-zA-Z_-]+:.*?## .*$$}' $(MAKEFILE_LIST) \
		| sort | awk 'BEGIN {FS = ":.*?## "}; \
		{printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


.PHONY: githooks
githooks: $(GITHOOKS) ## Symlink githooks
	@$(foreach hook,\
		$(GITHOOKS),\
		ln -sf $(hook) $(GITHOOKS_DEST)/$(hook##*/);\
	)


.PHONY: lint
lint: $(NODE_MODULES) $(ESLINT) $(ALL_FILES) ## Run lint checker (eslint).
	@NO_STYLE=true $(ESLINT) $(ALL_FILES)


.PHONY: style
style: $(NODE_MODULES) $(ESLINT) $(ALL_FILES) ## Run lint checker (eslint).
	@NO_LINT=true $(ESLINT) $(ALL_FILES)


.PHONY: fix-style
fix-style: $(NODE_MODULES) $(PRETTIER) ## Run prettier to auto fix style issues.
	@$(PRETTIER) --write "**/*.js"


.PHONY: security
security: $(NODE_MODULES) ## Check for dependency vulnerabilities.
	@$(NPM) audit


.PHONY: docs-build
docs-build: $(NODE_MODULES) $(DOCS_BUILD) ## Build documentation from JSDocs
	@($(NODE) $(DOCS_BUILD))


.PHONY: benchmark
benchmark: $(NODE_MODULES)
	@(cd ./benchmark && $(NPM) i && $(NODE) index.js)


.PHONY: prepush
prepush: $(NODE_MODULES) lint style test ## Git pre-push hook task. Run before committing and pushing.


.PHONY: test
test: $(NODE_MODULES) $(NODEUNIT) $(MOCHA) ## Run tests
	@$(NODEUNIT) test/*.test.js
	@$(MOCHA) -R spec test/plugins


.PHONY: coverage
coverage: $(NODE_MODULES) $(NYC) ## Run unit tests with coverage reporting. Generates reports into /coverage.
	@$(NYC) --reporter=lcov --report=json-summary make test


.PHONY: report-coverage
report-coverage: coverage ## Report test coverage to Coveralls
	@cat $(LCOV) | $(COVERALLS)


.PHONY: clean
clean: ## Cleans unit test coverage files and node_modules.
	@rm -rf $(NODE_MODULES) $(COVERAGE) $(COVERAGE_RES) $(PACKAGE_LOCK)


#
## Debug -- print out a a variable via `make print-FOO`
#
print-%  : ; @echo $* = $($*)
