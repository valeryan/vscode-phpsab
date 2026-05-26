# vscode-phpcbf

![Current Version](https://img.shields.io/visual-studio-marketplace/v/ValeryanM.vscode-phpsab)
![Installs](https://img.shields.io/visual-studio-marketplace/i/ValeryanM.vscode-phpsab)
![GitHub issues](https://img.shields.io/github/issues-raw/valeryan/vscode-phpsab)

Integrates [phpcs & phpcbf](https://github.com/squizlabs/PHP_CodeSniffer.git) into [Visual Studio Code](https://code.visualstudio.com/).

This extension is designed to use an auto config search functionality. When it finds a configuration file through auto search this extension should use that configuration file to create reports with phpcs and apply fixes with phpcbf based on the same configuration.

## Setup Development Version

-   install the [Visual Studio Code](https://code.visualstudio.com/) [npm extension](https://marketplace.visualstudio.com/items?itemName=eg2.vscode-npm-script)
-   clone this repository and checkout `develop` branch
-   open the cloned repository folder using [Visual Studio Code](https://code.visualstudio.com/)
-   run VS Code task `npm install`

## Run/Debug Development Version

To run the development version of the `vscode-phpsab` extension:

-   open the cloned repository folder using [Visual Studio Code](https://code.visualstudio.com/)
-   select sidebar option `Debug`
-   press `Start Debugging` button or hit F5

This will launch a new VS Code window named `Extension Development Host`, automatically using the development version of the `vscode-phpsab` extension.

## Installing the Development Version

To install a development version of this extension for testing you will need to install the vsce package and package the project into a `.vsix` file.

-   Install vsce: `npm install -g @vscode/vsce`
-   In the root of the project run: `vsce package`
-   From the VSCode main menu, select "Extensions", click the `...` on the Extensions tab.
-   Find the option that is `Install from VSIX...` and follow the prompts.
-   After installing, you may need to reload VSCode.

## Testing Docker mode locally

To exercise the optional Docker support during development, spin up a throwaway container that mounts your test project and has `phpcs`/`phpcbf` installed:

```sh
# from the test project root
docker run -d --name phpcs-test -v "$PWD":/app -w /app composer:latest tail -f /dev/null
docker exec phpcs-test composer global require "squizlabs/php_codesniffer:^3.7"
# or for PHPCS 4.x:
# docker exec phpcs-test composer global require "phpcsstandards/php_codesniffer:^4.0"
```

Then in the test project's `.vscode/settings.json`:

```json
{
  "phpsab.dockerEnabled": true,
  "phpsab.dockerContainer": "phpcs-test",
  "phpsab.dockerWorkspaceRoot": "/app",
  "phpsab.dockerExecutablePathCS": "/root/.composer/vendor/bin/phpcs",
  "phpsab.dockerExecutablePathCBF": "/root/.composer/vendor/bin/phpcbf"
}
```

Reload the Extension Development Host. Sniffer/Fixer commands should appear in the output channel as `docker exec -i phpcs-test …`. Stop the container to exercise the "container not running" warning path.

For Podman, set `"phpsab.dockerContainerExec": "podman"` and use `podman run`/`podman exec` in place of `docker`.

## Publishing Releases

Using the Release system on Github, draft a new release with the desired version tag. The github workflow should handle updating the package.json version and publishing the release to both Vs Marketplace and the Open VSX Registry. These both require a PAT to be set in the security section on github.com and will occasionally need to be updated or rotated if the publishing workflow fails.
