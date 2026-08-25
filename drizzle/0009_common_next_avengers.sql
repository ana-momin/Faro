CREATE TABLE `post_alert_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`postId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_alert_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_alert_user_post_unique` UNIQUE(`userId`,`postId`)
);
--> statement-breakpoint
ALTER TABLE `saved_posts` ADD `note` varchar(1000);--> statement-breakpoint
ALTER TABLE `saved_posts` ADD `priority` enum('normal','high') DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_posts` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
CREATE INDEX `post_alert_user_created_idx` ON `post_alert_deliveries` (`userId`,`createdAt`);