export interface PathResolver {
  resolve: () => Promise<string>;
  extension: string;
  pathSeparator: string;
}

export interface PathResolverOptions {
  workspaceRoot: string | null;
  composerJsonPath: string;
}
