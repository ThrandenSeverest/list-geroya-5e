from dataclasses import dataclass
import os


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/list-geroya.db")
    app_base_url: str = os.getenv("APP_BASE_URL", "").rstrip("/")
    session_days: int = int(os.getenv("SESSION_DAYS", "30"))
    password_iterations: int = int(os.getenv("PASSWORD_ITERATIONS", "310000"))
    vault_max_bytes: int = int(os.getenv("VAULT_MAX_BYTES", "2000000"))
    registration_enabled: bool = _bool("REGISTRATION_ENABLED", True)
    login_enabled: bool = _bool("LOGIN_ENABLED", True)
    email_verification_enabled: bool = _bool("EMAIL_VERIFICATION_ENABLED", False)
    require_verified_email: bool = _bool("REQUIRE_VERIFIED_EMAIL", False)
    email_delivery_enabled: bool = _bool("EMAIL_DELIVERY_ENABLED", False)
    password_reset_enabled: bool = _bool("PASSWORD_RESET_ENABLED", True)
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    email_from: str = os.getenv("EMAIL_FROM", "")
    cookie_secure: bool = _bool("COOKIE_SECURE", True)
    external_auth_base: str = os.getenv("EXT_AUTH_BASE", "https://vel.superaistory.fun/api/games/v1/ext-auth").rstrip("/")

    @property
    def email_delivery_configured(self) -> bool:
        return self.email_delivery_enabled and bool(self.email_from) and (
            bool(self.smtp_host and self.smtp_username and self.smtp_password)
            or bool(self.resend_api_key)
        )

    def public_auth_config(self) -> dict:
        return {"registrationEnabled": self.registration_enabled, "loginEnabled": self.login_enabled,
                "cloudSyncEnabled": True, "emailVerificationEnabled": self.email_verification_enabled,
                "requireVerifiedEmail": self.require_verified_email, "emailDeliveryEnabled": self.email_delivery_enabled,
                "passwordResetEnabled": self.password_reset_enabled, "sessionDays": self.session_days,
                "passwordIterations": self.password_iterations, "vaultMaxBytes": self.vault_max_bytes}


settings = Settings()
