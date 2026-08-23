CREATE TABLE `listened_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monitorId` int NOT NULL,
	`xPostId` varchar(64) NOT NULL,
	`authorId` varchar(64),
	`authorHandle` varchar(80),
	`authorName` varchar(160),
	`body` text NOT NULL,
	`postUrl` varchar(512),
	`postedAt` timestamp NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`language` varchar(24),
	`engagement` json NOT NULL,
	`matchedRule` varchar(1024) NOT NULL,
	`source` enum('x_api','demo') NOT NULL DEFAULT 'x_api',
	`ruleScore` int NOT NULL DEFAULT 0,
	`scoreExplanation` json NOT NULL,
	`aiIntent` json NOT NULL,
	`reviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedAt` timestamp,
	CONSTRAINT `listened_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `listened_post_unique` UNIQUE(`monitorId`,`xPostId`)
);
--> statement-breakpoint
CREATE TABLE `monitor_syncs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monitorId` int NOT NULL,
	`source` enum('filtered_stream','recent_search','demo') NOT NULL DEFAULT 'recent_search',
	`status` enum('idle','healthy','degraded','rate_limited','payment_required','error') NOT NULL DEFAULT 'idle',
	`latencyLabel` varchar(80) NOT NULL DEFAULT 'Not synced',
	`newestPostId` varchar(64),
	`nextToken` varchar(512),
	`lastSyncedAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastError` text,
	`lastDurationMs` int,
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitor_syncs_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitor_sync_monitor_unique` UNIQUE(`monitorId`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_criteria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`goal` text NOT NULL,
	`xQuery` varchar(1024) NOT NULL,
	`includeTerms` json NOT NULL,
	`excludeTerms` json NOT NULL,
	`categories` json NOT NULL,
	`status` enum('active','paused') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitoring_criteria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`decision` enum('approved','rejected') NOT NULL,
	`note` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `listened_post_monitor_score_idx` ON `listened_posts` (`monitorId`,`ruleScore`);--> statement-breakpoint
CREATE INDEX `listened_post_review_idx` ON `listened_posts` (`reviewStatus`);--> statement-breakpoint
CREATE INDEX `monitoring_criteria_user_idx` ON `monitoring_criteria` (`userId`);--> statement-breakpoint
CREATE INDEX `post_review_post_idx` ON `post_reviews` (`postId`);