import { PathResolverOptions } from '@phpsab/interfaces/pathResolver';
import { createResolveExecutablePath } from '@phpsab/resolvers/executablePathResolver';
import assert from 'assert';
import sinon from 'sinon';

suite('Executable Path Resolver Test Suite', () => {
  let globalResolverStub: sinon.SinonStub;
  let composerResolverStub: sinon.SinonStub;
  let resolveExecutablePath: any;

  setup(() => {
    globalResolverStub = sinon.stub();
    composerResolverStub = sinon.stub();
    resolveExecutablePath = createResolveExecutablePath(
      composerResolverStub,
      globalResolverStub,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('should resolve the executable path using composerResolver', async () => {
    const composerResolveSpy = sinon.spy();
    composerResolverStub.callsFake(
      (workspaceRoot, composerJsonPath, executable) => {
        const resolve = () => {
          composerResolveSpy();
          return `composer/path/${executable}`;
        };
        return { resolve };
      },
    );
    const globalResolveSpy = sinon.spy();
    globalResolverStub.callsFake((executable) => {
      const resolve = () => {
        globalResolveSpy();
        return `global/path/${executable}`;
      };
      return { resolve };
    });

    const options: PathResolverOptions = {
      workspaceRoot: 'myWorkspaceRoot',
      composerJsonPath: 'composer.json',
    };
    const executable = 'phpcs';

    const result = await resolveExecutablePath(options, executable);

    assert.strictEqual(result, `composer/path/${executable}`);
    assert(composerResolveSpy.calledOnce);
    assert(globalResolveSpy.notCalled);
  });

  test('should resolve the executable path using globalResolver', async () => {
    const composerResolveSpy = sinon.spy();
    composerResolverStub.returns({
      resolve: () => {
        composerResolveSpy();
        return null;
      },
    });
    const globalResolveSpy = sinon.spy();
    globalResolverStub.callsFake((executable) => ({
      resolve: () => {
        globalResolveSpy();
        return `global/path/${executable}`;
      },
    }));

    const options: PathResolverOptions = {
      workspaceRoot: 'myWorkspaceRoot',
      composerJsonPath: 'composer.json',
    };
    const executable = 'phpcs';

    const result = await resolveExecutablePath(options, executable);

    assert.strictEqual(result, `global/path/${executable}`);
    assert(composerResolveSpy.calledOnce);
    assert(globalResolveSpy.calledOnce);
  });

  test('should return an empty string if all resolvers return null', async () => {
    const composerResolveSpy = sinon.spy();
    composerResolverStub.returns({
      resolve: () => {
        composerResolveSpy();
        return null;
      },
    });
    const globalResolveSpy = sinon.spy();
    globalResolverStub.callsFake((executable) => ({
      resolve: () => {
        globalResolveSpy();
        return null;
      },
    }));

    const options: PathResolverOptions = {
      workspaceRoot: 'myWorkspaceRoot',
      composerJsonPath: 'composer.json',
    };
    const executable = 'phpcs';

    const result = await resolveExecutablePath(options, executable);

    assert.strictEqual(result, '');
    assert(composerResolveSpy.calledOnce);
    assert(globalResolveSpy.calledOnce);
  });
});
