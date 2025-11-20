# Changelog

## [0.0.20] - 2024-11-14

* Wrap the --stdin-path argument in double quotes by @jonathanbossenger in https://github.com/valeryan/vscode-phpsab/pull/139
* PHPCS urls and supported version by @jonathanbossenger in https://github.com/valeryan/vscode-phpsab/pull/140
* Escape filePath and args passed to the phpcs command by @aslamdoctor in https://github.com/valeryan/vscode-phpsab/pull/145

### New Contributors
* @aslamdoctor made their first contribution in https://github.com/valeryan/vscode-phpsab/pull/145

**Full Changelog**: https://github.com/valeryan/vscode-phpsab/compare/v.0.0.19...v.0.0.20

## [0.0.19] - 2024-09-02

* fix: Error: spawn EINVAL (#129) ([f9f1352](https://github.com/valeryan/vscode-phpsab/commit/f9f1352)), closes [#129](https://github.com/valeryan/vscode-phpsab/issues/129) [#128](https://github.com/valeryan/vscode-phpsab/issues/128)
* chore(development): add commitizen, update docs (#116) ([d0117bc](https://github.com/valeryan/vscode-phpsab/commit/d0117bc)), closes [#116](https://github.com/valeryan/vscode-phpsab/issues/116)
* chore(release): bump version to v0.0.18 (#117) ([c528257](https://github.com/valeryan/vscode-phpsab/commit/c528257)), closes [#117](https://github.com/valeryan/vscode-phpsab/issues/117) [#108](https://github.com/valeryan/vscode-phpsab/issues/108)
* fix bad github name (#112) ([2270cef](https://github.com/valeryan/vscode-phpsab/commit/2270cef)), closes [#112](https://github.com/valeryan/vscode-phpsab/issues/112)


## [0.0.18] - 2024-02-29

-   Fix global path resolver (#115) ([d30e3dc](https://github.com/valeryan/vscode-phpsab/commit/d30e3dc))

## [0.0.17] - 2024-02-29

-   Update the readme to include a note on setting paths in the settings UI
    Fixes #74

-   Adds empty check on executable paths
    Fixes #90

-   Updating dependencies for Node v18
-   Fixes after updating dependencies
-   dep updates, fix indents
-   Adds general script messages to the error log
    This allows users to see why phpcs or phpcbf might be failing
-   Updating maintenance status
-   Adding link to fork for Docker support
-   chore: Added scaffolding for unit testing
-   chore(Tests): Added unit tests for logger class
-   Update workflows for publishing and CodeQL
-   Add on demand for workflows
-   refresh & clean dependencies, apply prettier rules, fix config check
-   Fix package and add steps to use package as developer
-   Add a unit test workflow
-   switch to esbuild
-   declass pass 1: settings and logger
-   declass pass 2: path resolvers
-   declass pass 3: fixer and sniffer
-   Adding test for global path resolver
-   Set valid recommendations
-   move sinon to dev deps
-   import cleanup
-   point workflows to main
-   reword my maintenance notice
-   fix executable path examples

---

Co-authored-by: Jonathan Bossenger <jonathanbossenger@gmail.com>
Co-authored-by: Samuel Hilson <samuelrhilson@gmail.com>
Co-authored-by: Sibin Grasic <sibin.grasic@oblak.studio>

## [0.0.16] - 2022-12-01

-   Bump path-parse from 1.0.6 to 1.0.7 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/61
-   Bump minimist from 1.2.5 to 1.2.6 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/70
-   Bump ansi-regex from 3.0.0 to 3.0.1 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/72
-   Bump terser from 4.8.0 to 4.8.1 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/73
-   Bump loader-utils from 1.4.0 to 1.4.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/76
-   Bump decode-uri-component from 0.2.0 to 0.2.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/77
-   Set logLevel in configuration before attempting to log info. by @stormrockwell in https://github.com/valeryan/vscode-phpsab/pull/78
-   Fix Sniffer from exiting early based on the first folder's settings by @stormrockwell in https://github.com/valeryan/vscode-phpsab/pull/79
-   Bump flat and mocha by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/80
-   Bump json5 from 1.0.1 to 1.0.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/82
-   Bump glob-parent from 5.1.1 to 5.1.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/83
-   Bump minimatch and mocha by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/84
-   Bump nanoid and mocha by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/85

### New Contributors

-   @stormrockwell made their first contribution in https://github.com/valeryan/vscode-phpsab/pull/78

**Full Changelog**: https://github.com/valeryan/vscode-phpsab/compare/v.0.0.15...v.0.0.16

## [0.0.15] - 2022-01-01

-   Changed fixer to throw an exception if an empty document is returned.

## [0.0.14] - 2021-12-01

-   Add support for only fixing modified lines of code
-   Add a logging library that send debug info an output channel

## [0.0.13] - 2021-11-01

-   Dependency Update
-   Github Action to publish on tags

## [0.0.12] - 2021-10-01

-   Add support of options
-   Dependency Updates

## [0.0.11] - 2021-09-01

-   Remove phpclikill method.
-   Update dependencies

## [0.0.10] - 2021-08-01

-   Dependency Update for lodash

## [0.0.9] - 2021-07-01

-   Swap to webpack for bundling to reduce extension size
-   Revert removal of the php task killer

## [0.0.8] - 2021-06-01

-   Broken publish, bumping version to fix

## [0.0.7] - 2021-05-01

-   Fix typescript error with lodash

## [0.0.6] - 2021-04-01

-   Add better multi-root workspace support
-   The setting AutoConfigSearch is renamed to AutoRulesetSearch to make its purpose more clear
-   Extension activation was updated so that the `PHPCBF: Fix this file` is always registered even if phpcbf is not found.
-   Swapped to ESLint for internal code cleanup
-   Updated all Dependencies
-   Updated documentation to reflect some code changes

## 0.0.5

-   Remove timeout settings to support vscode 1.42 changes.

## [0.0.4] - 2021-02-01

-   Updated Dependencies
-   Fix an issue causing the content of files to be deleted by the Fixer
-   Add basic support for resolving standards files in a multi-workspace project

## [0.0.3] - 2021-01-01

-   Fix some language in the DEVELOPMENT.md
-   Fix some debug information
-   Add a check for windows OS to prevent the kill task command from firing on windows

## [0.0.2] - 2020-12-01

-   Adding Keywords for Marketplace

## [0.0.1] - 2020-11-01

-   Initial Alpha release
