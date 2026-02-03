/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js', '**/*.spec.js'],
  roots: ['<rootDir>/src'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/database/database.js', // Exclude database.js as it requires full DB setup for proper testing
    '!src/index.js', // Entry point, minimal logic
    '!src/init.js', // Initialization script
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
