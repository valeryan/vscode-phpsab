export const getPlatformExtension = (): string => {
  return /^win/.test(process.platform) ? '.bat' : '';
};

export const getPlatformPathSeparator = (): string => {
  return /^win/.test(process.platform) ? '\\' : '/';
};
