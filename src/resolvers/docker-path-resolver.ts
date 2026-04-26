import path from 'node:path';
import { isWin } from './path-resolver-utils';

const toPosix = (input: string): string => input.replace(/\\/g, '/');

const stripTrailingSlash = (input: string): string =>
  input.endsWith('/') && input.length > 1 ? input.slice(0, -1) : input;

const hasPathBoundaryPrefix = (inputPath: string, prefix: string): boolean => {
  const remainder = inputPath.slice(prefix.length);
  return remainder.length === 0 || remainder.startsWith('/');
};

export const isHostPathInsideWorkspace = (
  hostPath: string,
  hostWorkspaceRoot: string,
): boolean => {
  if (!hostPath || !hostWorkspaceRoot) {
    return false;
  }

  const normalisedHost = toPosix(hostPath);
  const normalisedRoot = stripTrailingSlash(toPosix(hostWorkspaceRoot));

  const hostForCompare = isWin()
    ? normalisedHost.toLowerCase()
    : normalisedHost;
  const rootForCompare = isWin()
    ? normalisedRoot.toLowerCase()
    : normalisedRoot;

  return (
    hostForCompare.startsWith(rootForCompare) &&
    hasPathBoundaryPrefix(hostForCompare, rootForCompare)
  );
};

/**
 * Translate a host filesystem path into the equivalent path inside the Docker
 * container, by replacing the host workspace root prefix with the container
 * workspace root.
 *
 * Returns the input unchanged when:
 * - either workspace root is empty (Docker is misconfigured); OR
 * - the input does not lie under the host workspace root (caller decides what
 *   to do — typically files outside the workspace can't be linted in-container).
 *
 * The match is performed on a path-segment boundary, so a host path like
 * `/repo/app2/file.php` is not remapped when the workspace is `/repo/app`.
 */
export const toContainerPath = (
  hostPath: string,
  hostWorkspaceRoot: string,
  containerWorkspaceRoot: string,
): string => {
  if (!hostPath || !hostWorkspaceRoot || !containerWorkspaceRoot) {
    return hostPath;
  }

  const normalisedHost = toPosix(hostPath);
  const normalisedRoot = stripTrailingSlash(toPosix(hostWorkspaceRoot));
  const normalisedContainerRoot = stripTrailingSlash(
    toPosix(containerWorkspaceRoot),
  );

  if (!isHostPathInsideWorkspace(hostPath, hostWorkspaceRoot)) {
    return hostPath;
  }

  const remainder = normalisedHost.slice(normalisedRoot.length);
  return normalisedContainerRoot + remainder;
};

/**
 * Translate a container path back to the equivalent host filesystem path.
 *
 * Same boundary/normalisation rules as {@link toContainerPath}. The output is
 * normalised through `path.normalize` on Windows so VS Code URI matching works
 * with backslashes.
 */
export const toHostPath = (
  containerPath: string,
  hostWorkspaceRoot: string,
  containerWorkspaceRoot: string,
): string => {
  if (!containerPath || !hostWorkspaceRoot || !containerWorkspaceRoot) {
    return containerPath;
  }

  const normalisedContainer = toPosix(containerPath);
  const normalisedContainerRoot = stripTrailingSlash(
    toPosix(containerWorkspaceRoot),
  );
  const normalisedHostRoot = stripTrailingSlash(toPosix(hostWorkspaceRoot));

  if (
    !normalisedContainer.startsWith(normalisedContainerRoot) ||
    !hasPathBoundaryPrefix(normalisedContainer, normalisedContainerRoot)
  ) {
    return containerPath;
  }

  const remainder = normalisedContainer.slice(normalisedContainerRoot.length);
  const joined = normalisedHostRoot + remainder;
  return isWin() ? path.normalize(joined) : joined;
};
