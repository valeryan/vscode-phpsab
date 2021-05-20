# Change Log

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
