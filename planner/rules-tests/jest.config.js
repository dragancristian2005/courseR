/** Separate config: runs only inside the Firestore emulator (npm run test:rules). */
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/**/*.rules.test.ts'],
  transform: { '^.+\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
};
