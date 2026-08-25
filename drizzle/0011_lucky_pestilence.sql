CREATE TABLE `hidden_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`xPostId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hidden_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `hidden_post_user_x_post_unique` UNIQUE(`userId`,`xPostId`)
);
--> statement-breakpoint
CREATE INDEX `hidden_post_user_created_idx` ON `hidden_posts` (`userId`,`createdAt`);