module.exports = {
  makeRedirectUri: () => '',
  useAuthRequest: () => [null, null, () => Promise.resolve(null)],
  ResponseType: { Code: 'code', Token: 'token' },
  Prompt: { Login: 'login', Consent: 'consent' },
  AuthSessionResult: {},
};
