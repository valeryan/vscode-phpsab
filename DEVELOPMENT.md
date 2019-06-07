# vscode-phpcbf

[![Current Version](https://vsmarketplacebadge.apphb.com/version/valeryanm.phpsab.svg)](https://marketplace.visualstudio.com/items?itemName=valeryanm.phpsab)
[![Install Count](https://vsmarketplacebadge.apphb.com/installs/valeryanm.phpsab.svg)](https://marketplace.visualstudio.com/items?itemName=valeryanm.phpsab)
[![Open Issues](https://vsmarketplacebadge.apphb.com/rating/valeryanm.phpsab.svg)](https://marketplace.visualstudio.com/items?itemName=valeryanm.phpsab)

Integrates [phpcbf](https://github.com/squizlabs/PHP_CodeSniffer.git) into [Visual Studio Code](https://code.visualstudio.com/).

This extension is designed to compliment the phpcs extension created by [Ioannis Kappas](https://github.com/ikappas/vscode-phpcs/). It uses some portions of that extension to create the auto config search functionality. This way if phpcs finds a configuration file through auto search this extension should similarly find that configuration file and apply fixes based on the same configuration.

## Setup Development Version

- install the [Visual Studio Code](https://code.visualstudio.com/) [npm extension](https://marketplace.visualstudio.com/items?itemName=eg2.vscode-npm-script)
- clone this repository and checkout `develop` branch
- open the cloned repository folder using [Visual Studio Code](https://code.visualstudio.com/)
- run VS Code task `npm install`

## Run/Debug Development Version

To run the development version of the `phpcbf` extension:

- open the cloned repository folder using [Visual Studio Code](https://code.visualstudio.com/)
- select sidebar option `Debug`
- press `Start Debugging` button or hit F5

This will launch a new VS Code window named `Extension Development Host`, automatically using the development version of the `phpcbf` extension.
