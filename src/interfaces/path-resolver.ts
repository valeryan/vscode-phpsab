export interface PathResolver {
  resolve: () => Promise<string>;
  extension: string;
  pathSeparator: string;
}
