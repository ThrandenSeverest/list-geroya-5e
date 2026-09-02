CREATE TABLE `character_vaults` (
	`user_email` text PRIMARY KEY NOT NULL,
	`vault_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
