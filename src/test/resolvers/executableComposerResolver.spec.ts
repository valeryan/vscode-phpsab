import { createComposerExecutablePathResolver } from '@phpsab/resolvers/executableComposerResolver';
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import sinon from 'sinon';

suite('Composer Path Resolver Test Suite', () => {
  let accessStub: sinon.SinonStub;
  let realPathStub: sinon.SinonStub;
  let isAbsoluteStub: sinon.SinonStub;
  let readFileStub: sinon.SinonStub;
  let joinPathsStub: sinon.SinonStub;

  setup(() => {
    // Stub fs.access method
    accessStub = sinon.stub(fs.promises, 'access');

    // Stub fs.realpath method
    realPathStub = sinon.stub(fs.promises, 'realpath');

    // Stub fs.readFile method
    readFileStub = sinon.stub(fs.promises, 'readFile');

    // Stub path.join method
    joinPathsStub = sinon.stub(path, 'join');

    // Stub path.isAbsolute method
    isAbsoluteStub = sinon.stub(path, 'isAbsolute');
  });

  teardown(() => {
    accessStub.restore();
    realPathStub.restore();
    readFileStub.restore();
    joinPathsStub.restore();
    isAbsoluteStub.restore();
  });

  test('The executable is found in vendor directory', async () => {
    // Setup stubs
    isAbsoluteStub.returns(false);
    joinPathsStub.callsFake((...args: string[]) => args.join('/'));
    realPathStub.resolves('/workspace/root/composer.json');
    readFileStub.resolves(
      JSON.stringify({
        config: {},
      }),
    );
    accessStub.resolves();

    // Act
    const composerPathResolver = createComposerExecutablePathResolver(
      '/workspace/root',
      'composer.json',
      'executable',
    );
    const path = await composerPathResolver.resolve();

    // Assert
    assert.strictEqual(path, '/workspace/root/vendor/bin/executable');
  });

  test('Returns empty string when unable to locate the composer.json file', async () => {
    // Setup stubs
    realPathStub.resolves(null);

    // Act
    const composerPathResolver = createComposerExecutablePathResolver(
      '/workspace/root',
      'composer.json',
      'executable',
    );
    const path = await composerPathResolver.resolve();

    // Assert
    assert.strictEqual(path, '');
  });

  test('Returns empty string when the executable does not exist in the vendor directory', async () => {
    // Setup stubs
    realPathStub.resolves('/workspace/root/composer.json');
    readFileStub.resolves(
      JSON.stringify({
        config: {},
      }),
    );
    accessStub.rejects(new Error('ENOENT'));

    // Act
    const composerPathResolver = createComposerExecutablePathResolver(
      '/workspace/root',
      'composer.json',
      'executable',
    );
    const path = await composerPathResolver.resolve();

    // Assert
    assert.strictEqual(path, '');
  });

  test('Returns empty string when the executable is not executable', async () => {
    // Setup stubs
    realPathStub.resolves('/workspace/root/composer.json');
    readFileStub.resolves(
      JSON.stringify({
        config: {},
      }),
    );
    accessStub.rejects(new Error('EACCES'));

    // Act
    const composerPathResolver = createComposerExecutablePathResolver(
      '/workspace/root',
      'composer.json',
      'executable',
    );
    const path = await composerPathResolver.resolve();

    // Assert
    assert.strictEqual(path, '');
  });
});
