export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  auth: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'change-me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
    accessTokenTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER,
    // SMTP настройки
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    smtpSecure: process.env.SMTP_SECURE !== 'false', // по умолчанию true
    verificationRedirectUrl: process.env.EMAIL_VERIFICATION_REDIRECT_URL,
    passwordResetRedirectUrl: process.env.PASSWORD_RESET_REDIRECT_URL,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  app: {
    backendBaseUrl: process.env.APP_BACKEND_BASE_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || '4000'}`,
    frontendBaseUrl: process.env.APP_FRONTEND_BASE_URL || 'http://localhost:8081',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 's3',
    endpoint: process.env.STORAGE_ENDPOINT,
    bucket: process.env.STORAGE_BUCKET,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
    region: process.env.STORAGE_REGION || 'us-east-1',
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL,
    maxFileSizeMb: parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB || '5', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
});
