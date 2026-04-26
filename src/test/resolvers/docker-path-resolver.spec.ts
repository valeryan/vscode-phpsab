import assert from 'assert';
import sinon from 'sinon';
import {
  toContainerPath,
  toHostPath,
} from '../../resolvers/docker-path-resolver';

suite('Docker Path Resolver Test Suite', () => {
  let platformStub: sinon.SinonStub;

  teardown(() => {
    platformStub?.restore();
  });

  const stubPlatform = (value: NodeJS.Platform) => {
    platformStub = sinon.stub(process, 'platform').value(value);
  };

  test('Linux host -> Linux container', () => {
    stubPlatform('linux');
    const result = toContainerPath(
      '/home/me/proj/src/Foo.php',
      '/home/me/proj',
      '/var/www/proj',
    );
    assert.strictEqual(result, '/var/www/proj/src/Foo.php');
  });

  test('Linux host -> Linux container, trailing slash on roots is tolerated', () => {
    stubPlatform('linux');
    const result = toContainerPath(
      '/home/me/proj/src/Foo.php',
      '/home/me/proj/',
      '/var/www/proj/',
    );
    assert.strictEqual(result, '/var/www/proj/src/Foo.php');
  });

  test('Windows host -> Linux container', () => {
    stubPlatform('win32');
    const result = toContainerPath(
      'C:\\Users\\me\\proj\\src\\Foo.php',
      'C:\\Users\\me\\proj',
      '/var/www/proj',
    );
    assert.strictEqual(result, '/var/www/proj/src/Foo.php');
  });

  test('Windows host -> Linux container, drive-letter case differs', () => {
    stubPlatform('win32');
    const result = toContainerPath(
      'c:\\Users\\me\\proj\\src\\Foo.php',
      'C:\\Users\\me\\proj',
      '/var/www/proj',
    );
    assert.strictEqual(result, '/var/www/proj/src/Foo.php');
  });

  test('toContainerPath returns input unchanged when outside the workspace', () => {
    stubPlatform('linux');
    const result = toContainerPath(
      '/elsewhere/Foo.php',
      '/home/me/proj',
      '/var/www/proj',
    );
    assert.strictEqual(result, '/elsewhere/Foo.php');
  });

  test('toContainerPath does not match a non-segment-boundary prefix', () => {
    stubPlatform('linux');
    // /home/me/proj is the workspace; /home/me/proj2 must not be remapped.
    const result = toContainerPath(
      '/home/me/proj2/src/Foo.php',
      '/home/me/proj',
      '/var/www/proj',
    );
    assert.strictEqual(result, '/home/me/proj2/src/Foo.php');
  });

  test('toContainerPath returns input unchanged when a root is empty', () => {
    stubPlatform('linux');
    assert.strictEqual(
      toContainerPath('/a/b', '', '/var/www'),
      '/a/b',
      'host workspace root empty',
    );
    assert.strictEqual(
      toContainerPath('/a/b', '/a', ''),
      '/a/b',
      'container workspace root empty',
    );
  });

  test('toHostPath remaps container path back to Linux host', () => {
    stubPlatform('linux');
    const result = toHostPath(
      '/var/www/proj/src/Foo.php',
      '/home/me/proj',
      '/var/www/proj',
    );
    assert.strictEqual(result, '/home/me/proj/src/Foo.php');
  });

  test('toHostPath remaps container path back to Windows host', () => {
    stubPlatform('win32');
    const result = toHostPath(
      '/var/www/proj/src/Foo.php',
      'C:\\Users\\me\\proj',
      '/var/www/proj',
    );
    assert.strictEqual(result, 'C:\\Users\\me\\proj\\src\\Foo.php');
  });

  test('toHostPath returns input unchanged when outside the container workspace', () => {
    stubPlatform('linux');
    const result = toHostPath('/etc/passwd', '/home/me/proj', '/var/www/proj');
    assert.strictEqual(result, '/etc/passwd');
  });

  test('round-trip on Linux: host -> container -> host', () => {
    stubPlatform('linux');
    const hostRoot = '/home/me/proj';
    const containerRoot = '/var/www/proj';
    const start = '/home/me/proj/src/Foo.php';
    const round = toHostPath(
      toContainerPath(start, hostRoot, containerRoot),
      hostRoot,
      containerRoot,
    );
    assert.strictEqual(round, start);
  });

  test('round-trip on Windows: host -> container -> host', () => {
    stubPlatform('win32');
    const hostRoot = 'C:\\Users\\me\\proj';
    const containerRoot = '/var/www/proj';
    const start = 'C:\\Users\\me\\proj\\src\\Foo.php';
    const round = toHostPath(
      toContainerPath(start, hostRoot, containerRoot),
      hostRoot,
      containerRoot,
    );
    assert.strictEqual(round, start);
  });
});
