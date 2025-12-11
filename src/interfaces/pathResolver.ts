export interface PathResolver {
  resolve: () => Promise<string>;
}

export interface PathResolverOptions {
  workspaceRoot: string | null;
  composerJsonPath: string;
}
