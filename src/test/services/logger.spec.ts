import { logger } from '@phpsab/services/logger';
import assert from 'assert';
import sinon from 'sinon';
import { window } from 'vscode';

const setupTestSuite = (debugMode: boolean): [sinon.SinonSpy] => {
  const mockOutputChannel = window.createOutputChannel('PHP SAB UNIT TEST');
  logger.setupOutputChannel(mockOutputChannel);
  logger.setDebugMode(debugMode);
  const appendLineSpy = sinon.spy(mockOutputChannel, 'appendLine');
  return [appendLineSpy];
};

suite('Logger Test Suite - Debug Mode: On', () => {
  let appendLineSpy: sinon.SinonSpy;

  setup(() => {
    [appendLineSpy] = setupTestSuite(true);
  });

  teardown(() => {
    logger.setDebugMode(true);
    appendLineSpy.restore();
  });

  test('logger.info should log a message', () => {
    logger.info('Test info message');
    assert.ok(appendLineSpy.calledWithMatch(/Test info message/));
  });

  test('logger.debug should log a messages and data', () => {
    logger.debug('Test debug message', { data: 'data' });
    assert.ok(appendLineSpy.calledTwice);

    // First call should have the message
    assert.ok(appendLineSpy.firstCall.calledWithMatch(/Test debug message/));

    // Second call should have the data object as a JSON string
    const expectedDataString = JSON.stringify({ data: 'data' }, null, 2).trim();
    assert.ok(appendLineSpy.secondCall.calledWith(expectedDataString));
  });

  test('logger.startTimer should log a message', () => {
    logger.startTimer('Test');
    assert.ok(appendLineSpy.calledWithMatch(/Test running/));
  });

  test('logger.endTimer should log a message, if startTimer was called.', () => {
    logger.startTimer('Test1');
    logger.endTimer('Test1');
    assert.ok(appendLineSpy.calledWithMatch(/Test1 ran for/));
  });

  test('logger.endTimer should log not started, if startTimer was not called.', () => {
    logger.endTimer('Test2');
    assert.ok(appendLineSpy.calledWithMatch(/Test2 timer was not started/));
  });
});

suite('Logger Test Suite - Debug Mode: Off', () => {
  let appendLineSpy: sinon.SinonSpy;

  setup(() => {
    [appendLineSpy] = setupTestSuite(false);
  });

  teardown(() => {
    logger.setDebugMode(false);
    appendLineSpy.restore();
  });

  test('logger.info should not log a message', () => {
    logger.info('Test info message');
    assert.ok(appendLineSpy.notCalled);
  });

  test('logger.debug should not log a message or data', () => {
    logger.debug('Test debug message', { data: 'data' });
    assert.ok(appendLineSpy.notCalled);
  });

  test('logger.startTimer should not log a message', () => {
    logger.startTimer('Test');
    assert.ok(appendLineSpy.notCalled);
  });

  test('logger.endTimer should not log a message', () => {
    logger.endTimer('Test');
    assert.ok(appendLineSpy.notCalled);
  });
});

suite('Logger Test Suite - Debug Mode: On or Off', () => {
  let appendLineSpy: sinon.SinonSpy;

  setup(() => {
    [appendLineSpy] = setupTestSuite(true);
  });

  teardown(() => {
    logger.setDebugMode(true);
    appendLineSpy.restore();
  });

  test('logger.log should always log a message', () => {
    logger.log('Test log message');
    assert.ok(appendLineSpy.calledWithMatch(/Test log message/));

    // Should be unaffected by debug mode
    logger.setDebugMode(false);
    logger.log('Test log message');
    assert.ok(appendLineSpy.calledWithMatch(/Test log message/));
  });

  test('logger.error should always log a message', () => {
    logger.error('Test error message');
    assert.ok(appendLineSpy.calledWithMatch(/Test error message/));

    // Should be unaffected by debug mode
    logger.setDebugMode(false);
    logger.error('Test error message');
    assert.ok(appendLineSpy.calledWithMatch(/Test error message/));
  });

  test('logger.error should log a message and optional Error object', () => {
    const errorMessage = 'Test error message';
    const errorObject = new Error('I am Error!');

    logger.error(errorMessage, errorObject);
    assert.ok(appendLineSpy.calledWithMatch(new RegExp(errorMessage)));

    // Assert that the error object is stringified and logged as JSON
    const expectedErrorString = JSON.stringify(errorObject, null, 2).trim();
    assert.ok(appendLineSpy.calledWithMatch(new RegExp(expectedErrorString)));

    // Should be unaffected by debug mode
    logger.setDebugMode(false);
    logger.error(errorMessage, errorObject);
    assert.ok(appendLineSpy.calledWithMatch(new RegExp(errorMessage)));

    // Assert that the error message is logged even when debug mode is off
    assert.ok(appendLineSpy.calledWithMatch(new RegExp(errorMessage)));
  });
});
