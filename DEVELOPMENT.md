# vscode-phpcbf

![Current Version](https://img.shields.io/open-vsx/v/ValeryanM/vscode-phpsab?label=version)
![VS Marketplace Installs](https://img.shields.io/badge/VS_Marketplace_Installs-~300k-brightgreen)
![Open VSX Registry Installs](https://img.shields.io/open-vsx/dt/ValeryanM/vscode-phpsab?label=VSX%20Installs)
![GitHub issues](https://img.shields.io/github/issues-raw/valeryan/vscode-phpsab)

Integrates [phpcs & phpcbf](https://github.com/squizlabs/PHP_CodeSniffer.git) into [Visual Studio Code (VS Code)](https://code.visualstudio.com/).

This extension is designed to use an auto config search functionality. When it finds a configuration file through auto search this extension should use that configuration file to create reports with phpcs and apply fixes with phpcbf based on the same configuration.

## Setup Development Version

- Install the VS Code [npm extension](https://marketplace.visualstudio.com/items?itemName=eg2.vscode-npm-script)
- Install the VS Code [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) (for linting and auto-fixing code)
- Clone this repository and checkout `develop` branch
- Open the cloned repository folder using VS Code
- Install the dependencies using `npm install`

## Run/Debug Development Version

To run the development version of the `vscode-phpsab` extension:

- Open the cloned repository folder using VS Code
- Select sidebar option `Debug`
- Press `Start Debugging` button or hit <kbd>F5</kbd>

This will launch a new VS Code window named `Extension Development Host`, automatically using the development version of the `vscode-phpsab` extension.

## Installing the Development Version

To install a development version of this extension for testing you will need to install the vsce package and package the project into a `.vsix` file.

- Install vsce: `npm install -g @vscode/vsce`
- In the root of the project run: `vsce package`
- From the VSCode main menu, select "Extensions", click the `...` on the Extensions tab.
- Find the option that is `Install from VSIX...` and follow the prompts.
- After installing, you may need to reload VSCode.

## Publishing Releases

Using the Release system on Github, draft a new release with the desired version tag. The github workflow should handle updating the package.json version and the changelog. It will then publish the release to both VS Marketplace and the Open VSX Registry. These both require a PAT to be set in the security section on github.com and will occasionally need to be updated or rotated if the publishing workflow fails.
