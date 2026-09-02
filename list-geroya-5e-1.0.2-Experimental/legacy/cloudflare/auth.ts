export const authConfig = {
  // Временный режим 1.0.1.B Experimental: аккаунты создаются без письма.
  // После подключения домена и RESEND_API_KEY переключите следующие три
  // значения на true: emailVerificationEnabled, requireVerifiedEmail,
  // emailDeliveryEnabled. Остальная логика подтверждения уже реализована.
  registrationEnabled: true,
  loginEnabled: true,
  cloudSyncEnabled: true,
  emailVerificationEnabled: false,
  requireVerifiedEmail: false,
  emailDeliveryEnabled: false,
  // Маршруты сброса пароля готовы. Пока emailDeliveryEnabled=false,
  // запрос сброса безопасно отвечает 503 и не создаёт недоставляемую ссылку.
  passwordResetEnabled: true,
  sessionDays: 30,
  passwordIterations: 310_000,
  vaultMaxBytes: 2_000_000,
} as const;
