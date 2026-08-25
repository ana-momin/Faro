CREATE TABLE `saved_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`postId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_post_user_post_unique` UNIQUE(`userId`,`postId`)
);
--> statement-breakpoint
CREATE INDEX `saved_post_user_created_idx` ON `saved_posts` (`userId`,`createdAt`);