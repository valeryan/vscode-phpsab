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

## Publishing Releases
Using the Release system on Github, draft a new release with the desired version tag. The github workflow should handle updating the package.json version and publishing the release to both Vs Marketplace and the Open VSX Registry. These both require a PAT to be set in the security section on github.com and will occasionally need to be updated or rotated if the publishing workflow fails.
