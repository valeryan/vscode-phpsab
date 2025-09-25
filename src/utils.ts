import { ExtensionContext, extensions } from 'vscode';
import { ExtensionInfo } from './interfaces/extensionInfo';

const extensionInfo: ExtensionInfo = {} as ExtensionInfo;

export const setExtensionInfo = (context: ExtensionContext) => {
  // Get extension unique identifier from context
  const id = context.extension.id;
  const packageJSON = extensions.getExtension(id)?.packageJSON;

  extensionInfo.id = id;
  extensionInfo.displayName = packageJSON?.displayName;
  extensionInfo.version = packageJSON?.version;
};

export const getExtensionInfo = (): ExtensionInfo => {
  return extensionInfo;
};
