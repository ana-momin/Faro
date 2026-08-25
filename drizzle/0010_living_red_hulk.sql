CREATE TABLE `provider_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('twitterapi_io','official_x') NOT NULL,
	`encryptedCredential` text NOT NULL,
	`credentialHint` varchar(16) NOT NULL,
	`dailyRequestLimit` int NOT NULL DEFAULT 20,
	`automaticCollection` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_connection_user_unique` UNIQUE(`userId`)
);
