# PHP Sniffer & Beautifier for VS Code

![Current Version](https://img.shields.io/visual-studio-marketplace/v/ValeryanM.vscode-phpsab)
![Installs](https://img.shields.io/visual-studio-marketplace/i/ValeryanM.vscode-phpsab)
![GitHub issues](https://img.shields.io/github/issues-raw/valeryan/vscode-phpsab)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

This linter plugin for [Visual Studio Code](https://code.visualstudio.com/) provides an wrapper for [phpcs & phpcbf](http://pear.php.net/package/PHP_CodeSniffer/). It will be used with files that have the “PHP” language mode. This extension is designed to use an **auto configuration search mechanism** to apply rulesets to files within a folder or workspace. The extension will search for and apply the nearest ruleset it finds as it transverse up the file path. This is useful for developers who work with many different projects that have different coding standards within a single project or workspaces.

## Maintenance Status

[valeryan](https://github.com/valeryan) is the creator of this extension but his focus has shifted away from PHP to .NET development, he is currently unable to dedicate much time to maintaining this project. However, the extension is fully operational in its current state. If you're interested in contributing as a co-maintainer to address any outstanding issues, please feel free to get in touch with any maintainers on this project.

### Active Maintainers

In June 2023 [jonathanbossenger](https://github.com/jonathanbossenger) reached out to me and offered to help with maintaining the extension. I have added him as a contributor and he will be monitoring new issues and helping me review PRs. I will still be around to help out if needed.

In January 2024 [seebeen](https://github.com/seebeen) signed on to be a maintainer for this project and has been granted contributor status.

## Installation

Visual Studio Code must be installed in order to use this plugin. If Visual Studio Code is not installed, please follow the instructions [here](https://code.visualstudio.com/Docs/editor/setup).

## Usage

<kbd>F1</kbd> -> `PHPCBF: Fix this file`

or keyboard shortcut `alt+shift+f` vs code default formatter shortcut

or right mouse context menu `Format Document`.

### Format on save

You can also use this formatter with Format on Save enabled. Format on save has two modes: `File` and `Modified`. This extension implements support for the modified mode by using phpcbf with the `Git Modified` filter that is provided by phpcbf.

## Cross Platform Path Support

Going forward all path configuration should be done in a unix style. This means all paths should be configured using `/`. Where `/` will represent the root of the OS and on windows will be assumed to be the `C:\` drive. Other drives can be indicated like `/d/` (this would resolve to `/` on linux and the `/d` will be ignored). For specifying a path for `phpcs` or `phpcbf` do not include any extension such as `.bat`, it will be added for you. This will allow the settings for this extension to synchronize across systems using vscode settings sync and still function.

> **Note:** The default for this extension is to leave the path configurations empty or default and let the auto resolver handle it for you. If you are using this extension but disabling all of its auto-magic handling of paths why are you really using it? ...

## Multi-Root Workspace Support

This extension now fully supports Multi-Root Workspaces. The extension previously used the first root folder in your workspace to configure and run both `phpcs` and `phpcbf`. The new system allows each workspace to be configured and run independently with respect to the root folder of the open file being sniffed. This means you can have `phpcs` functionality in one folder and have it disabled in another within a workspace.

## Linter Installation

Before using this plugin, you must ensure that `phpcs` is installed on your system. The preferred method is using [composer](https://getcomposer.org/) for both system-wide and project-wide installations.

Once phpcs is installed, you can proceed to install the vscode-phpsab plugin if it is not yet installed.

> **NOTE:** This plugin can detect whether your project has been set up to use phpcbf via composer and use the project specific `phpcs & phpcbf` over the system-wide installation of `phpcs & phpcbf` automatically. This feature requires that both composer.json and composer.lock file exist in your workspace root or the `phpsab.composerJsonPath` in order to check for the composer dependency. If you wish to bypass this feature see: `phpsab.snifferExecutablePath` and `phpsab.fixerExecutablePath`.

> **NOTE:** `phpcbf` is installed along with `phpcs`.

### System-wide Installation

The `phpcs` linter can be installed globally using the Composer Dependency Manager for PHP.

1. Install [composer](https://getcomposer.org/doc/00-intro.md).
2. Require `phpcs` package by typing the following in a terminal:

    ```bash
    composer global require squizlabs/php_codesniffer
    ```

3. You must specifically add the phpcs and phpcbf that you want to used to the global PATH on your system for the extension to auto detect them or set the executablePath for phpcs and phpcbf manually.

### Project-wide Installation

The `phpcs` linter can be installed in your project using the Composer Dependency Manager for PHP.

1. Install [composer](https://getcomposer.org/doc/00-intro.md).
2. Require `phpcs` package by typing the following at the root of your project in a terminal:

    ```bash
    composer require --dev squizlabs/php_codesniffer
    ```

### Plugin Installation

1. Open Visual Studio Code.
2. Press `Ctrl+P` on Windows or `Cmd+P` on Mac to open the Quick Open dialog.
3. Type ext install phpsab to find the extension.
4. Press Enter or click the cloud icon to install it.
5. Restart Visual Studio Code!

### Docker support

If you would like to run phpcs in your docker containers using this extension, a [fork exists](https://github.com/mtbdata711/vscode-phpsab-docker) that will provide you with Docker support.

## Configuration

There are various options that can be configured to control how the plugin operates which can be set in your user, workspace or folder preferences.

### **phpsab.composerJsonPath**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* composer.json ]

Specify the path to your `composer.json` file if it's not located at the workspace root (default). You can provide either the absolute path or a workspace-relative path in a unix style.

```json
{
    "phpsab.composerJsonPath": "/Path/to/composer.json"
}
```

> **Note:** The extension does not apply any automatic search logic to the composer.json path.

### **phpsab.standard**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* null ]

This setting controls the coding standard used by `phpcbf`. You may specify the name, absolute path or workspace relative path of the coding standard to use.

> **NOTE:** While using composer dependency manager over global installation make sure you use the phpcbf commands under your project scope !

The following values are applicable:

1. This setting can be set to `null`, which is the default behavior and uses the `default_standard` when set in the `phpcs` configuration or fallback to the `Pear` coding standard.

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

2. The setting can be set to the name of a built-in coding standard ( ie. `MySource`, `PEAR`, `PHPCS`, `PSR1`, `PSR2`, `Squiz`, `Zend` ) and you are good to go.

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

### **phpsab.snifferEnable**

[ *Scope:* Resource | Optional | *Type:* boolean | *Default:* true ]

This setting controls whether `phpcs` sniffer is enabled.

### **phpsab.snifferArguments**

[ _Scope:_ Resource | Optional | _Type:_ string[] | _Default:_ [] ]

Passes additional arguments to `phpcs` runner.

_Example_

```bash
{
    phpsab.snifferArguments: ["-n", "--ignore=tests/*"]
}

# Translated
phpcs -n --ignore=tests/* <file>
```

### **phpsab.snifferExecutablePath**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* null ]

This setting controls the executable path for `phpcs`. Leave this as default to to allow the extension to find `phpcs` for you using composer.json or your system path. You may specify the absolute path or workspace relative path to the `phpcs` executable using unix like Uris. See [Cross Platform Path Support](#cross-platform-path-support)

> **NOTE:** `phpcbf` is installed along with `phpcs`.

```json
{
    "phpsab.snifferExecutablePath": "/C/Path/To/Global/Composer/vendor/bin/phpcs"
}
```

> All paths should be provided in unix style, for windows users the path will get translated by the extension, to specify the drive in windows use `/C/`.

### **phpsab.snifferMode**

[ *Scope:* All | Optional | *Type:* string | *Default:* onSave ]

Enum dropdown options to set Sniffer Mode to `onSave` or `onType`.

1. `onSave`: The Sniffer will only update diagnostics when the document is saved.

2. `onType`: The Sniffer will update diagnostics as you type in a document.

### **phpsab.snifferTypeDelay**

[ *Scope:* All | Optional | *Type:* number | *Default:* 250 ]

When `snifferMode` is `onType` this setting controls how long to wait after typing stops to update. The number represents milliseconds.

### **phpsab.snifferShowSources**

[ *Scope:* All | Optional | *Type:* boolean | *Default:* false ]

Determines if the Sniffer includes the source of the diagnostic data with error messages.

### **phpsab.fixerEnable**

[ *Scope:* Resource | Optional | *Type:* boolean | *Default:* true ]

This setting controls whether `phpcbf` fixer is enabled.

### **phpsab.fixerArguments**

[ _Scope:_ Resource | Optional | _Type:_ string[] | _Default:_ [] ]

Passes additional arguments to `phpcbf` runner.

_Example_

```bash
{
    phpsab.fixerArguments: ["-n", "--ignore=tests/*"]
}

# Translated
phpcbf -n --ignore=tests/* <file>
```

### **phpsab.fixerExecutablePath**

[ *Scope:* Resource | Optional | *Type:* string | *Default:* null ]

This setting controls the executable path for `phpcbf`. Leave this as default to to allow the extension to find `phpcbf` for you using composer.json or your system path. You may specify the absolute path or workspace relative path to the `phpcbf` executable using unix style Uris to disable auto searching. See [Cross Platform Path Support](#cross-platform-path-support)

> **NOTE:** `phpcbf` is installed along with `phpcs`.

```json
{
    "phpsab.fixerExecutablePath": "/C/Path/To/Global/Composer/vendor/bin/phpcbf"
}
```

> All paths should be provided in unix style, for windows users the path will get translated by the extension, to specify the drive in windows use `/C/`.

## Diagnosing common errors

### **phpsab.debug**

[ *Scope:* All | Optional | *Type:* boolean | Default: false ]

Choose if debug information should be sent to PHP Sniffer & Beautifier output channel and enable the displaying information notices.

> **Note:** Errors are always sent to the output channel

### The phpcs report contains invalid json

This error occurs when something goes wrong in phpcs execution such as PHP Notices, PHP Fatal Exceptions, Other Script Output, etc, most of which can be detected as follows:

Execute the phpcbf command in your terminal with --report=json and see whether the output contains anything other than valid json.

## Deprecated Settings

### **phpsab.executablePathCS**

(Deprecated in version 0.1.0)

This setting has moved to **phpsab.snifferExecutablePath**. This setting will be fully removed in later releases. Please update your settings.

### **phpsab.executablePathCBF**

(Deprecated in version 0.1.0)

This setting has moved to **phpsab.fixerExecutablePath**. This setting will be fully removed in later releases. Please update your settings.

## Acknowledgements

This extension draws inspiration from and utilizes certain portions of code from the following extensions:

-   [vscode-phpcs](https://github.com/ikappas/vscode-phpcs/) by Ioannis Kappas
-   [vscode-phpcbf](https://github.com/soderlind/vscode-phpcbf) by Per Søderlind
-   [vscode-php-sniffer](https://github.com/wongjn/vscode-php-sniffer) by wongjn

These extensions provided valuable functionality and insights that contributed to the development of this project.

## Contributing and Licensing

The project is hosted on [GitHub](https://github.com/valeryan/vscode-phpsab) where you can [report issues](https://github.com/valeryan/vscode-phpsab/issues), fork
the project and submit pull requests. See the [development guide](https://github.com/valeryan/vscode-phpsab/blob/main/DEVELOPMENT.md) for details.

The project is available under [MIT license](https://github.com/valeryan/vscode-phpsab/blob/main/LICENSE.md), which allows modification and redistribution for both commercial and non-commercial purposes.
