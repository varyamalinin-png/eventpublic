module.exports = {
  openAuthSessionAsync: () => Promise.resolve({ type: 'cancel' }),
  openBrowserAsync: () => Promise.resolve({ type: 'cancel' }),
  maybeCompleteAuthSession: () => ({ type: 'success' }),
  WebBrowserResultType: { CANCEL: 'cancel', DISMISS: 'dismiss', OPENED: 'opened' },
};
