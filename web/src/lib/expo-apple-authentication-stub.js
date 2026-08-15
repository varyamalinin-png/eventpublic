// Web stub for expo-apple-authentication
module.exports = {
  signInAsync: async () => { throw new Error('Apple Sign In not available on web'); },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  isAvailableAsync: async () => false,
};
