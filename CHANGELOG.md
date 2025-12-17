# Changelog

## [0.0.22] - 2025-12-17

### What's Changed
* Remove the commitizen package and update readme by @valeryan in https://github.com/valeryan/vscode-phpsab/pull/179
* feat: ability to opt out of displaying the auto fixability icons by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/185
* fix: add logging for auto ruleset search and fallback scenarios by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/186
* fix: catch error messages from fixer stdout by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/188
* Feat: Add support for the `--exclude` additional argument by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/192
* Add PHPCS version compatibility checks and warn on 4.x usage by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/193


**Full Changelog**: https://github.com/valeryan/vscode-phpsab/compare/v0.0.21...v0.0.22


## [0.0.21] - 2025-12-01

### What's Changed
* Revert "Escape filePath and args passed to the phpcs command (#145)" by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/155
* Bump serialize-javascript and mocha by @dependabot[bot] in https://github.com/valeryan/vscode-phpsab/pull/159
* Bump esbuild from 0.20.1 to 0.25.0 by @dependabot[bot] in https://github.com/valeryan/vscode-phpsab/pull/164
* Adding YCodeTech to readme by @valeryan in https://github.com/valeryan/vscode-phpsab/pull/166
* Update readme to include links to VSX Open Registry and VS Code Marketplace by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/167
* fix: empty document error when no changes needed by @dossy in https://github.com/valeryan/vscode-phpsab/pull/160
* Removes the newline at the end of the fixed code by @jonathanbossenger in https://github.com/valeryan/vscode-phpsab/pull/142
* Support single file mode by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/170
* Feat: Display icons on problems to determine their auto fixability by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/165
* Fix spaces in paths and validating arguments by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/172
* Update dependencies to latest by @valeryan in https://github.com/valeryan/vscode-phpsab/pull/177
* Adding back auto versioning by @valeryan in https://github.com/valeryan/vscode-phpsab/pull/151
* Fix php not found by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/157
* Release v0.0.21 by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/176
* fix: update vscode compatibility version by @yCodeTech in https://github.com/valeryan/vscode-phpsab/pull/180

### New Contributors
* @dossy made their first contribution in https://github.com/valeryan/vscode-phpsab/pull/160

**Full Changelog**: https://github.com/valeryan/vscode-phpsab/compare/v0.0.20...v0.0.21


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

## [0.0.17] - 2024-02-27

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

## [0.0.16] - 2023-01-03

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
