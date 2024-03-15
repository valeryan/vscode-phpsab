import { createGlobalExecutablePathResolver } from '@phpsab/resolvers/executable-global-resolver';
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import sinon from 'sinon';

suite('Global Path Resolver Test Suite', () => {
  let accessStub: sinon.SinonStub;
  let env: NodeJS.ProcessEnv;
  let platformStub: sinon.SinonStub;
  let joinPathsStub: sinon.SinonStub;

  setup(() => {
    // Stub fs.access method
    accessStub = sinon.stub(fs.promises, 'access');
    // Save the original environment PATH
    env = process.env;
    // Stub process.platform to control platform value
    platformStub = sinon.stub(process, 'platform').value('win32');

    // Stub path.join method directly
    joinPathsStub = sinon.stub(path, 'join');
  });

  teardown(() => {
    // Restore fs.access method
    accessStub.restore();
    // Restore the environment PATH
    process.env = env;
    // Restore path.join method
    joinPathsStub.restore();
    // Restore process.platform
    platformStub.restore();
  });

  test('Global Path Resolver should resolve path on Windows', async () => {
    process.env.PATH = 'C:\\Windows\\System32;C:\\Program Files\\nodejs';
    accessStub.resolves(); // Make fs.access resolve successfully
    joinPathsStub.callsFake((...args: string[]) => args.join('\\'));
    const resolver = createGlobalExecutablePathResolver('executable');
    const resolvedPath = await resolver.resolve();
    assert.strictEqual(resolvedPath, 'C:\\Windows\\System32\\executable');
  });

  test('Global Path Resolver should resolve path on Unix-like systems', async () => {
    platformStub.value('linux'); // Set platform to linux for this test
    process.env.PATH = '/usr/bin:/usr/local/bin:/opt/bin';
    accessStub.resolves(); // Make fs.access resolve successfully
    joinPathsStub.callsFake((...args: string[]) => args.join('/'));
    const resolver = createGlobalExecutablePathResolver('executable');
    const resolvedPath = await resolver.resolve();
    assert.strictEqual(resolvedPath, '/usr/bin/executable');
  });

  test('Global Path Resolver should handle PATH with empty segments', async () => {
    platformStub.value('linux'); // Set platform to linux for this test
    process.env.PATH = '/usr/bin:/usr/local/bin::/opt/bin';
    accessStub.resolves(); // Make fs.access resolve successfully
    joinPathsStub.callsFake((...args: string[]) => args.join('/'));
    const resolver = createGlobalExecutablePathResolver('executable');
    const resolvedPath = await resolver.resolve();
    assert.strictEqual(resolvedPath, '/usr/bin/executable');
  });

  test('Global Path Resolver should return empty string if executable not found', async () => {
    platformStub.value('linux'); // Set platform to linux for this test
    process.env.PATH = '/usr/bin:/usr/local/bin:/opt/bin';
    accessStub.rejects(new Error('File not found')); // Make fs.access reject
    joinPathsStub.callsFake((...args: string[]) => args.join('/'));
    const resolver = createGlobalExecutablePathResolver('nonexistent');
    const resolvedPath = await resolver.resolve();
    assert.strictEqual(resolvedPath, '');
  });
});
