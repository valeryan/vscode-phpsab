# PHP Sniffer & Beautifier for VS Code

![Current Version](https://img.shields.io/open-vsx/v/ValeryanM/vscode-phpsab?label=version)
![VS Marketplace Installs](https://img.shields.io/badge/VS_Marketplace_Installs-~300k-brightgreen)
![Open VSX Registry Installs](https://img.shields.io/open-vsx/dt/ValeryanM/vscode-phpsab?label=VSX%20Installs)
![GitHub issues](https://img.shields.io/github/issues-raw/valeryan/vscode-phpsab)

This linter plugin for [Visual Studio Code](https://code.visualstudio.com/) provides an interface to [phpcs & phpcbf](https://github.com/PHPCSStandards/PHP_CodeSniffer). It will be used with files that have the “PHP” language mode. This extension is designed to use auto configuration search mechanism to apply rulesets to files within a workspace. This is useful for developers who work with many different projects that have different coding standards.

This extension is available on both [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ValeryanM.vscode-phpsab) and [Open VSX Registry](https://open-vsx.org/extension/ValeryanM/vscode-phpsab).

<details open>
<summary><b>Table of Contents</b></summary>

- [PHPCS Version Support](#phpcs-version-support)
- [Maintenance Status](#maintenance-status)
    - [Active Maintainers](#active-maintainers)
- [Installation](#installation)
- [Usage](#usage)
    - [Format on save](#format-on-save)
- [Multi-Root Workspace Support](#multi-root-workspace-support)
- [Single File Mode Support](#single-file-mode-support)
- [Linter Installation](#linter-installation)
    - [System-wide Installation](#system-wide-installation)
    - [Project-wide Installation](#project-wide-installation)
    - [Plugin Installation](#plugin-installation)
    - [Docker support](#docker-support)
- [Basic Configuration](#basic-configuration)
    - [**phpsab.fixerEnable**](#phpsabfixerenable)
    - [**phpsab.fixerArguments**](#phpsabfixerarguments)
    - [**phpsab.snifferEnable**](#phpsabsnifferenable)
    - [**phpsab.snifferArguments**](#phpsabsnifferarguments)
    - [**phpsab.executablePathCS**](#phpsabexecutablepathcs)
    - [**phpsab.executablePathCBF**](#phpsabexecutablepathcbf)
    - [**phpsab.standard**](#phpsabstandard)
    - [**phpsab.autoRulesetSearch**](#phpsabautorulesetsearch)
    - [**phpsab.allowedAutoRulesets**](#phpsaballowedautorulesets)
    - [**phpsab.snifferMode**](#phpsabsniffermode)
    - [**phpsab.snifferTypeDelay**](#phpsabsniffertypedelay)
    - [**phpsab.snifferShowSources**](#phpsabsniffershowsources)
    - [**phpsab.snifferShowFixabilityIcons**](#phpsabsniffershowfixabilityicons)
- [Advanced Configuration](#advanced-configuration)
    - [**phpsab.composerJsonPath**](#phpsabcomposerjsonpath)
    - [**phpsab.phpExecutablePath**](#phpsabphpexecutablepath)
    - [**phpsab.excludeGlobs**](#phpsabexcludeglobs)
- [Docker support](#docker-support-1)
    - [Quick start](#quick-start)
    - [Settings reference](#settings-reference)
    - [Auto-deriving the container executable paths](#auto-deriving-the-container-executable-paths)
    - [Notes](#notes)
- [Diagnosing common errors](#diagnosing-common-errors)
    - [**phpsab.debug**](#phpsabdebug)
    - [The phpcs report contains invalid json](#the-phpcs-report-contains-invalid-json)
- [Acknowledgements](#acknowledgements)
- [Contributing and Licensing](#contributing-and-licensing)

</details>

## PHPCS Version Support

This extension supports both [PHP_CodeSniffer 3.x](https://github.com/PHPCSStandards/PHP_CodeSniffer/releases/) and 4.x. If you are using an older version of PHPCS, please upgrade to a supported 3.x or 4.x release.

> **NOTE:** As of v0.1.0, PHPCS 4.x is fully supported. The extension handles the new PHPCBF exit codes (`4`, `5`, `7`) and will only warn when the detected `phpcs`/`phpcbf` binaries are at mismatched major versions.

## Maintenance Status

My focus has shifted away from PHP to .NET development, I'm currently unable to dedicate much time to maintaining this project. However, the extension is fully operational in its current state. If you're interested in contributing as a co-maintainer to address any outstanding issues, please feel free to get in touch with me.

### Active Maintainers

In Sept of 2025 [yCodeTech](https://github.com/yCodeTech) was added as a maintainer.

In June 2023 [jonathanbossenger](https://github.com/jonathanbossenger) reached out to me and offered to help with maintaining the extension. I have added him as a contributor and he will be monitoring new issues and helping me review PRs. I will still be around to help out if needed.

In January 2024 [seebeen](https://github.com/seebeen) signed on to be a maintainer for this project and has been granted contributor status. (Currently Inactive)

## Installation

Visual Studio Code must be installed in order to use this plugin. If Visual Studio Code is not installed, please follow the instructions [here](https://code.visualstudio.com/Docs/editor/setup).

## Usage

<kbd>F1</kbd> -> `PHPCBF: Fix this file`

or keyboard shortcut `alt+shift+f` vs code default formatter shortcut

or right mouse context menu `Format Document`.

### Format on save

You can also use this formatter with Format on Save enabled via the setting `editor.formatOnSave`.

Format on save has two modes: `File` and `Modified`, via the setting `editor.formatOnSaveMode`. To enable usage of the modified mode, this extension supports the `Git Modified` filter argument provided by PHPCBF: `--filter=GitModified`. Just add it to the extension's `phpsab.fixerArguments` setting.

## Multi-Root Workspace Support

This extension now fully supports Multi-Root Workspaces. The extension previously used the first root folder in your workspace to configure and run both phpcs and phpcbf. The new system allows each workspace to be configured and run independently with respect to the root folder of the open file being sniffed. This means you can have phpcs functionality in one folder and have it disabled in another within a workspace.

## Single File Mode Support

This extension now supports formatting single files without needing a workspace folder open (single file mode). Both phpcs and phpcbf will work in this mode.

When in single file mode:

- The global user settings are used instead of workspace settings.
- The `phpsab.autoRulesetSearch` setting is ignored, and will essentially act as if it was set to `false` (and just return the value as set in `phpsab.standard`).

A global composer setup is required:

- The `phpsab.executablePathCS` and `phpsab.executablePathCBF` settings **must** be set to the full absolute path of phpcs and phpcbf respectively, _OR_ set them to empty strings to allow the extension to automatically find the global composer installation and resolve the paths to the globally installed phpcs/phpcbf.

- If the `phpsab.standard` setting is used for a ruleset file then it **must** be the full absolute path.

## Linter Installation

Before using this plugin, you must ensure that `phpcs` is installed on your system. The preferred method is using [composer](https://getcomposer.org/) for both system-wide and project-wide installations.

Once phpcs is installed, you can proceed to install the vscode-phpsab plugin if it is not yet installed.

> **NOTE:** This plugin can detect whether your project has been set up to use phpcbf via composer and use the project specific `phpcs & phpcbf` over the system-wide installation of `phpcs & phpcbf` automatically. This feature requires that both composer.json and composer.lock file exist in your workspace root or the `phpsab.composerJsonPath` in order to check for the composer dependency. If you wish to bypass this feature you can set the `phpsab.executablePathCS` and `phpsab.executablePathCBF` configuration settings.

> **NOTE:** `phpcbf` is installed along with `phpcs`.

### System-wide Installation

The `phpcs` linter can be installed globally using the Composer Dependency Manager for PHP.

1. Install [composer](https://getcomposer.org/doc/00-intro.md).
1. Require `phpcs` package by typing the following in a terminal:

    ```bash
    composer global require squizlabs/php_codesniffer
    ```

1. You must specifically add the phpcs and phpcbf that you want to used to the global PATH on your system for the extension to auto detect them or set the executablePath for phpcs and phpcbf manually.

### Project-wide Installation

The `phpcs` linter can be installed in your project using the Composer Dependency Manager for PHP.

1. Install [composer](https://getcomposer.org/doc/00-intro.md).
1. Require `phpcs` package by typing the following at the root of your project in a terminal:

    ```bash
    composer require --dev squizlabs/php_codesniffer
    ```

### Plugin Installation

1. Open Visual Studio Code.
1. Press <kbd>Ctrl + P</kbd> on Windows or <kbd>Cmd + P</kbd> on Mac to open the Quick Open dialog.
1. Type `ext install phpsab` to find the extension.
1. Press <kbd>Enter</kbd> or click the cloud icon to install it.
1. Restart Visual Studio Code!

This extension is available on both [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ValeryanM.vscode-phpsab) and [Open VSX Registry](https://open-vsx.org/extension/ValeryanM/vscode-phpsab).

### Docker support

This extension can run `phpcs` and `phpcbf` inside a running Docker container instead of on the host. Docker mode is opt-in per workspace folder — see the [Docker support](#docker-support-1) section below for the full reference.

## Basic Configuration

There are various options that can be configured to control how the plugin operates which can be set
in your user, workspace or folder preferences.

### **phpsab.fixerEnable**

[ *Scope:* Resource | Optional | *Type:* boolean | *Default:* true ]

This setting controls whether `phpcbf` fixer is enabled.

### **phpsab.fixerArguments**

[ _Scope:_ Resource | Optional | _Type:_ string[] | _Default:_ [] ]

Passes additional arguments to `phpcbf` runner.

> **IMPORTANT:**
> The only additional arguments this extension supports are:
>
> - `--filter` (values either `GitModified`, `GitStaged`, or a path to a custom filter class.)
> - `--ignore` (a comma-separated list of glob patterns matching files and/or directories.)
> - `--severity` (0-10)
> - `--error-severity` (0-10)
> - `--warning-severity` (0-10)
> - `--ignore-annotations` (just a boolean flag.)
> - `--exclude` (a comma-separated list of sniffs to exclude.)
>
> Any other arguments passed or values will be ignored. This is to prevent malicious code from being executed.

> **NOTE:** All arguments passed will be surrounded in double quotes automatically.

_Example_

```bash
{
    phpsab.fixerArguments: ["--ignore=tests/*"]
}

# Translated
phpcbf "--ignore=tests/*" <file>
```

### **phpsab.snifferEnable**

[ *Scope:* Resource | Optional | *Type:* boolean | *Default:* true ]

This setting controls whether `phpcs` sniffer is enabled.

### **phpsab.snifferArguments**

[ _Scope:_ Resource | Optional | _Type:_ string[] | _Default:_ [] ]

Passes additional arguments to `phpcs` runner.

> **IMPORTANT:**
> The only additional arguments this extension supports are:
>
> - `--filter` (values either `GitModified`, `GitStaged`, or a path to a custom filter class.)
> - `--ignore` (a comma-separated list of glob patterns matching files and/or directories.)
> - `--severity` (0-10)
> - `--error-severity` (0-10)
> - `--warning-severity` (0-10)
> - `--ignore-annotations` (just a boolean flag.)
> - `--exclude` (a comma-separated list of sniffs to exclude.)
>
> Any other arguments passed or values will be ignored. This is to prevent malicious code from being executed.

> **NOTE:** All arguments passed will be surrounded in double quotes automatically.

_Example_

```bash
{
    phpsab.snifferArguments: ["--ignore=tests/*"]
}

# Translated
phpcs "--ignore=tests/*" <file>
```

### **phpsab.executablePathCS**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* null ]

This setting controls the executable path for `phpcs`. You may specify the absolute path or workspace relative path to the `phpcs` executable.
If omitted, the plugin will try to locate `phpcs` using you local composer.json, then your global environment path.

> **NOTE:** `phpcbf` is installed along with `phpcs`.

```json
{
    "phpsab.executablePathCS": "C:\\Users\\enter-your-username-here\\AppData\\Roaming\\Composer\\vendor\\bin\\phpcs.bat"
}
```

> **NOTE:** If you are setting this value in the extension settings user interface, make sure to leave out the quotes

```
C:\\Users\\enter-your-username-here\\AppData\\Roaming\\Composer\\vendor\\bin\\phpcs.bat
```

### **phpsab.executablePathCBF**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* null ]

This setting controls the executable path for the `phpcbf`. You may specify the absolute path or workspace relative path to the `phpcbf` executable.
If omitted, the extension will try to locate `phpcbf` using you local composer.json, then your global environment path.

```json
{
    "phpsab.executablePathCBF": "C:\\Users\\enter-your-username-here\\AppData\\Roaming\\Composer\\vendor\\bin\\phpcbf.bat"
}
```

> **NOTE:** If you are setting this value in the extension settings user interface, make sure to leave out the quotes

```
C:\\Users\\enter-your-username-here\\AppData\\Roaming\\Composer\\vendor\\bin\\phpcbf.bat
```

### **phpsab.standard**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* null ]

This setting controls the coding standard used by `phpcs` and `phpcbf`. You may specify the name, absolute path or workspace relative path of the coding standard to use.

> **NOTE:** While using composer dependency manager over global installation make sure you use the phpcbf commands under your project scope !

The following values are applicable:

1. This setting can be set to `null`, which is the default behavior and uses the `default_standard` when set in the `phpcs` configuration or fallback to the `Pear` coding standard. `phpcs` may find a ruleset through it's own auto search, in which case that ruleset will be used instead.

    ```json
    {
        "phpsab.standard": null
    }
    ```

    You may set the `default_standard` used by phpcbf using the following command:

    ```bash
    phpcs --config-set default_standard <value>
    ```

    or when using composer dependency manager from the root of your project issue the following command:

    ```bash
    ./vendor/bin/phpcs --config-set default_standard <value>
    ```

2. The setting can be set to the name of a built-in coding standard ( ie. `PEAR`, `PSR1`, `PSR2`, `PSR12`, `Squiz`, `Zend` ) and you are good to go.

    ```json
    {
        "phpsab.standard": "PSR2"
    }
    ```

3. The setting can be set to the name of a custom coding standard ( ie. `WordPress`, `Drupal`, etc. ). In this case you must ensure that the specified coding standard is installed and accessible by `phpcbf`.

    ```json
    {
        "phpsab.standard": "WordPress"
    }
    ```

    After you install the custom coding standard, you can make it available to phpcbf by issuing the following command:

    ```bash
    phpcs --config-set installed_paths <path/to/custom/coding/standard>
    ```

    or when using composer dependency manager from the root of your project issue the following command:

    ```bash
    ./vendor/bin/phpcs --config-set installed_paths <path/to/custom/coding/standard>
    ```

4. The setting can be set to the absolute path to a custom coding standard:

    ```json
    {
        "phpsab.standard": "/path/to/coding/standard"
    }
    ```

    or you can use the path to a custom ruleset:

    ```json
    {
        "phpsab.standard": "/path/to/project/phpcs.xml"
    }
    ```

5. The setting can be set to your workspace relative path to a custom coding standard:

    ```json
    {
        "phpsab.standard": "./vendor/path/to/coding/standard"
    }
    ```

    or you can use the path to your project's custom ruleset:

    ```json
    {
        "phpsab.standard": "./phpcs.xml"
    }
    ```

### **phpsab.autoRulesetSearch**

[ *Scope:* Resource | Optional | *Type:* boolean | *Default:* true ]

Automatically search for any `.phpcs.xml`, `.phpcs.xml.dist`, `phpcs.xml`, `phpcs.xml.dist`, `phpcs.ruleset.xml` or `ruleset.xml` file to use as configuration. Overrides `phpsab.standard` configuration when a ruleset is found. If `phpcs` finds a configuration file through auto search this extension should similarly find that configuration file and apply fixes based on the same configuration.

> **NOTE:** This option does not apply for unsaved documents (in-memory). Also, the name of files that are searched for is configurable in this extension.

### **phpsab.allowedAutoRulesets**

[ _Scope:_ Resource | Optional | _Type:_ array | _Default:_ [] ]

An array of filenames that could contain a valid phpcs ruleset.

```json
{
    "phpsab.allowedAutoRulesets": ["phpcs.xml", "special.xml"]
}
```

### **phpsab.snifferMode**

[ *Scope:* All | Optional | *Type:* string | *Default:* onSave ]

Enum dropdown options to set Sniffer Mode to `onSave` or `onType`.

1. `onSave`: The Sniffer will only update diagnostics when the document is saved.

1. `onType`: The Sniffer will update diagnostics as you type in a document.

### **phpsab.snifferTypeDelay**

[ *Scope:* All | Optional | *Type:* number | *Default:* 250 ]

When `snifferMode` is `onType` this setting controls how long to wait after typing stops to update. The number represents milliseconds.

### **phpsab.snifferShowSources**

[ *Scope:* All | Optional | *Type:* boolean | *Default:* false ]

Determines if the Sniffer includes the source error code of the diagnostic data with error messages (eg. `Squiz.WhiteSpace.FunctionSpacing.Before`).

### **phpsab.snifferShowFixabilityIcons**

[ *Scope:* All | Optional | *Type:* boolean | *Default:* true ]

Determines if the Sniffer shows auto-fixable icons in the Problems panel (and on-hover intellisense) for each diagnostic.

A check mark (✔️) indicates that the issue is auto-fixable by phpcbf, while a cross mark (❌) indicates that it is not and must be fixed manually.

By default, the icons will be shown, but can be disabled by setting this option to `false`.

## Advanced Configuration

### **phpsab.composerJsonPath**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* composer.json ]

This setting allows you to override the path to your composer.json file when it does not reside at the workspace root. You may specify the absolute path or workspace relative path to the `composer.json` file.

### **phpsab.phpExecutablePath**

[ *Scope:* All | Optional | *Type:* string | *Default:* null ]

This setting controls the path for the `php` executable. If you don't have PHP in your system `PATH` and the extension errors that it cannot find PHP, then you may specify the absolute path to the directory where `php` executable can be found. This setting will only be used if PHP isn't set in VSCode's built-in PHP setting `php.validate.executablePath` or Devsense's "PHP Tools" extension setting `php.executablePath`.

The order of precedence for finding PHP path in the settings is as follows:

1. VSCode's built-in "PHP Language Features" extension setting `php.validate.executablePath`.
2. Devsense's "PHP Tools" extension setting `php.executablePath`.
3. This extension's `phpsab.phpExecutablePath` setting.

The path should lead to the directory where the executable can be found, abd shouldn't include the actual executable itself.

On Windows, if it detects the path has `php.exe` at the end, then it will be removed from the path. On other systems, it won't detect or remove anything.

Bad Example:

Where `php` is the executable.

```json
{
    "phpsab.phpExecutablePath": "path/to/executable/directory/php"
}
```

Good Example:

```json
{
    "phpsab.phpExecutablePath": "path/to/executable/directory"
}
```

> **NOTE:** Changing this setting or the external 3rd party settings after the extension has activated requires restarting VScode. It will not currently update the `php` executable in the environment `PATH` automatically until after a VScode restart.

### **phpsab.excludeGlobs**

[ _Scope:_ Resource | Optional | _Type:_ array | _Default:_ [
"\*\*/vendor/\*\*",
"\*\*/node_modules/\*\*"
] ]

This setting allows you to specify an array of glob patterns to exclude PHP files from being processed by the Sniffer and Fixer. By default, the `vendor` and `node_modules` directories are excluded.

This is useful for excluding third-party libraries, dependencies, and intellisense stub files that you do not want to be checked or modified by phpcs/phpcbf.

## Docker support

This extension can run `phpcs` and `phpcbf` inside a running Docker container instead of (or alongside) a locally installed binary. Docker mode is opt-in and applies per workspace folder, so a multi-root workspace can mix Docker-enabled folders and local-binary folders freely.

### Quick start

Add the following to your workspace's `.vscode/settings.json`:

```json
{
    "phpsab.dockerEnabled": true,
    "phpsab.dockerContainer": "<container name or ID>",
    "phpsab.dockerWorkspaceRoot": "<absolute container path matching the host workspace root>"
}
```

#### Worked example

If you develop a WordPress plugin at `/home/me/Projects/MyPlugin` on your host, mounted at `/var/www/html/wp-content/plugins/MyPlugin` inside a container named `wordpress`:

```json
{
    "phpsab.dockerEnabled": true,
    "phpsab.dockerContainer": "wordpress",
    "phpsab.dockerWorkspaceRoot": "/var/www/html/wp-content/plugins/MyPlugin"
}
```

The extension will translate the host file path into the container path before invoking `phpcs`, then translate any container paths in the report back to host paths.

### Settings reference

| Setting | Default | Description |
|---------|---------|-------------|
| `phpsab.dockerEnabled` | `false` | Run `phpcs` and `phpcbf` inside a container. When `false`, all other `phpsab.docker*` settings are ignored. |
| `phpsab.dockerContainer` | `""` | Name or ID of the running container. Required when `dockerEnabled` is `true`. |
| `phpsab.dockerWorkspaceRoot` | `""` | Absolute container path that corresponds to the host workspace root. Required when `dockerEnabled` is `true`. |
| `phpsab.dockerExecutablePathCS` | `""` | Optional. Absolute container path to `phpcs`. If empty, derived from `phpsab.executablePathCS` by replacing the workspace prefix. |
| `phpsab.dockerExecutablePathCBF` | `""` | Optional. Absolute container path to `phpcbf`. If empty, derived from `phpsab.executablePathCBF`. |
| `phpsab.dockerContainerExec` | `"docker"` | Single executable used to enter the container. Set to `"podman"` (or an absolute path) for drop-in replacements. Compound commands such as `"docker compose"` are not supported. |
| `phpsab.dockerUseFilepath` | `false` | Sniffer-only. Pass the file path positionally to `phpcs` instead of streaming via stdin. Disables linting of unsaved buffers; the fixer ignores this setting and always uses stdin mode. |

### Auto-deriving the container executable paths

When `phpsab.dockerExecutablePathCS`/`CBF` is left empty, the extension takes the resolved host executable path (typically a project-local `vendor/bin/phpcs`) and replaces the host workspace prefix with `phpsab.dockerWorkspaceRoot`. This works only when the executable lives under the mounted workspace.

For container-only installations (e.g. `phpcs` at `/usr/local/bin/phpcs` inside the container, with no host counterpart), set `phpsab.dockerExecutablePathCS` and `phpsab.dockerExecutablePathCBF` explicitly.

### Notes

- Docker mode requires an open workspace folder. It is not supported in single-file mode because there is no host workspace root to map.
- `phpsab.dockerContainer` must be a literal container name or ID. Docker Compose service names are not supported (use `docker exec <container>` semantics).
- `docker exec` adds noticeable latency. Keeping `phpsab.snifferMode` at the default `"onSave"` is recommended for Docker workspaces.
- If the container is not running or `phpsab.dockerContainerExec` is not on `PATH`, the extension will warn once and disable the affected tools for that workspace; the rest of the editor remains usable.

## Diagnosing common errors

### **phpsab.debug**

[ *Scope:* All | Optional | *Type:* boolean | Default: false ]

Write debug information to the `PHP Sniffer & Beautifier` output channel and enable the display of extra notices.

### The phpcs report contains invalid json

This error occurs when something goes wrong in phpcs execution such as PHP Notices, PHP Fatal Exceptions, Other Script Output, etc, most of which can be detected as follows:

Execute the `phpcbf` command in your terminal with `--report=json` and see whether the output contains anything other than valid json.

## Acknowledgements

This extension is based off of the `phpcs` extension created by [Ioannis Kappas](https://github.com/ikappas/vscode-phpcs/), the `PHP Sniffer` extension create by [wongjn](https://github.com/wongjn/vscode-php-sniffer) and the existing `phpcbf` extension by [Per Søderlind](https://github.com/soderlind/vscode-phpcbf). It uses some portions of these extensions to provide the `phpcs & phpcbf` functionality with auto config search.

## Contributing and Licensing

The project is hosted on [GitHub](https://github.com/valeryan/vscode-phpsab) where you can [report issues](https://github.com/valeryan/vscode-phpsab/issues), fork
the project and submit pull requests. See the [development guide](https://github.com/valeryan/vscode-phpsab/blob/main/DEVELOPMENT.md) for details.

The project is available under [MIT license](https://github.com/valeryan/vscode-phpsab/blob/main/LICENSE.md), which allows modification and redistribution for both commercial and non-commercial purposes.
