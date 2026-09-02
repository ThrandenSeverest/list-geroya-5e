PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `password_hash` text,
  `password_salt` text,
  `auth_provider` text DEFAULT 'email' NOT NULL,
  `email_verified_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `auth_sessions_token_unique` ON `auth_sessions` (`token_hash`);

CREATE TABLE IF NOT EXISTS `auth_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `purpose` text NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `auth_tokens_token_unique` ON `auth_tokens` (`token_hash`);

CREATE TABLE IF NOT EXISTS `auth_rate_limits` (
  `key` text PRIMARY KEY NOT NULL,
  `attempts` integer DEFAULT 1 NOT NULL,
  `expires_at` integer NOT NULL
);

INSERT OR IGNORE INTO `users` (`id`, `email`, `auth_provider`, `email_verified_at`)
SELECT 'legacy:' || lower(`user_email`), lower(`user_email`), 'chatgpt', CURRENT_TIMESTAMP FROM `character_vaults`;

CREATE TABLE `character_vaults_new` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `vault_json` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT OR REPLACE INTO `character_vaults_new` (`user_id`, `vault_json`, `updated_at`)
SELECT 'legacy:' || lower(`user_email`), `vault_json`, `updated_at` FROM `character_vaults`;
DROP TABLE `character_vaults`;
ALTER TABLE `character_vaults_new` RENAME TO `character_vaults`;

PRAGMA foreign_keys=ON;

