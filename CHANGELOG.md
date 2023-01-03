# Change Log
## 0.0.16
* Bump path-parse from 1.0.6 to 1.0.7 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/61
* Bump minimist from 1.2.5 to 1.2.6 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/70
* Bump ansi-regex from 3.0.0 to 3.0.1 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/72
* Bump terser from 4.8.0 to 4.8.1 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/73
* Bump loader-utils from 1.4.0 to 1.4.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/76
* Bump decode-uri-component from 0.2.0 to 0.2.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/77
* Set logLevel in configuration before attempting to log info. by @stormrockwell in https://github.com/valeryan/vscode-phpsab/pull/78
* Fix Sniffer from exiting early based on the first folder's settings by @stormrockwell in https://github.com/valeryan/vscode-phpsab/pull/79
* Bump flat and mocha by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/80
* Bump json5 from 1.0.1 to 1.0.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/82
* Bump glob-parent from 5.1.1 to 5.1.2 by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/83
* Bump minimatch and mocha by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/84
* Bump nanoid and mocha by @dependabot in https://github.com/valeryan/vscode-phpsab/pull/85

## New Contributors
* @stormrockwell made their first contribution in https://github.com/valeryan/vscode-phpsab/pull/78

**Full Changelog**: https://github.com/valeryan/vscode-phpsab/compare/v.0.0.15...v.0.0.16
## 0.0.15
- Changed fixer to throw an exception if an empty document is returned.

## 0.0.14
- Add support for only fixing modified lines of code
- Add a logging library that send debug info an output channel
## 0.0.13
- Dependency Update
- Github Action to publish on tags

## 0.0.12
- Add support of options
- Dependency Updates

## 0.0.11
-  Remove phpclikill method. 
-  Update dependencies

## 0.0.10
-   Dependency Update for lodash

## 0.0.9
-   Swap to webpack for bundling to reduce extension size
-   Revert removal of the php task killer

## 0.0.8
-   Broken publish, bumping version to fix

## 0.0.7
-   Fix typescript error with lodash

## 0.0.6
-   Add better multi-root workspace support
-   The setting AutoConfigSearch is renamed to AutoRulesetSearch to make its purpose more clear
-   Extension activation was updated so that the `PHPCBF: Fix this file` is always registered even if phpcbf is not found.
-   Swapped to ESLint for internal code cleanup
-   Updated all Dependencies
-   Updated documentation to reflect some code changes

## 0.0.5

-   Remove timeout settings to support vscode 1.42 changes.

## 0.0.4

-   Updated Dependencies
-   Fix an issue causing the content of files to be deleted by the Fixer
-   Add basic support for resolving standards files in a multi-workspace project

## 0.0.3

-   Fix some language in the DEVELOPMENT.md
-   Fix some debug information
-   Add a check for windows OS to prevent the kill task command from firing on windows

## 0.0.2

-   Adding Keywords for Marketplace

## 0.0.1

-   Initial Alpha release
