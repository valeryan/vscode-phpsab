import * as vscode from 'vscode';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { Logger } from '../../logger';

suite('Logger Test Suite', () => {
  let logger: Logger;
  let appendLineSpy: sinon.SinonSpy;

  setup(() => {
    logger = new Logger();
    appendLineSpy = sinon.spy(logger['outputChannel'], 'appendLine');
  });

  teardown(() => {
    appendLineSpy.restore();
  });

  test('Logger should log info messages', () => {
    logger.setOutputLevel('INFO');
    logger.logInfo('Test info message');
    assert.ok(appendLineSpy.calledWithMatch(/Test info message/));
  });

  test('Logger should log error messages', () => {
    logger.setOutputLevel('ERROR');
    logger.logError('Test error message');
    assert.ok(appendLineSpy.calledWithMatch(/Test error message/));
  });

  test('Logger should not log info messages when level is ERROR', () => {
    logger.setOutputLevel('ERROR');
    logger.logInfo('Test info message');
    assert.ok(appendLineSpy.notCalled);
  });

  test('Logger should start and end time', () => {
    logger.setOutputLevel('INFO');
    logger.time('Test');
    assert.ok(appendLineSpy.calledWithMatch(/Test running/));
    logger.timeEnd('Test');
    assert.ok(appendLineSpy.calledWithMatch(/Test ran for/));
  });

  test('Logger should log error objects', () => {
    logger.setOutputLevel('ERROR');
    const error = new Error('Test error');
    logger.logError('Test error message', error);
    assert.ok(appendLineSpy.calledWithMatch(/Test error/));
  });

  test('Logger should log error strings', () => {
    logger.setOutputLevel('ERROR');
    logger.logError('Test error message', 'Test error string');
    assert.ok(appendLineSpy.calledWithMatch(/Test error string/));
  });
});
