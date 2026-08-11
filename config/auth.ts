export const authConfig = {
  registrationEnabled: true,
  loginEnabled: true,
  cloudSyncEnabled: true,
  emailVerificationEnabled: false,
  requireVerifiedEmail: false,
  emailDeliveryEnabled: false,
  passwordResetEnabled: true,
  sessionDays: 30,
  passwordIterations: 310_000,
  vaultMaxBytes: 2_000_000,
} as const;

