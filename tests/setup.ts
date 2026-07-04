/**
 * Jest setup file
 * Runs before all tests
 */

// Increase timeout for integration tests with LLM calls
jest.setTimeout(60000);

// Suppress console output during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
