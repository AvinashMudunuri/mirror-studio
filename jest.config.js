/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@mirror/(.*)$': '<rootDir>/packages/$1/src',
    '^uuid$': require.resolve('uuid')
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        // Mirror moduleNameMapper so ts-jest type-checking resolves
        // workspace packages from source without requiring a build.
        baseUrl: '.',
        paths: {
          '@mirror/*': ['packages/*/src']
        }
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts'
  ],
  testTimeout: 60000, // 60 seconds for LLM calls
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
