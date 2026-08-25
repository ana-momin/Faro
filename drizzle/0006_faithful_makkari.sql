CREATE TABLE `monitor_query_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monitorId` int NOT NULL,
	`familyId` varchar(48) NOT NULL,
	`queryHash` varchar(64) NOT NULL,
	`queryPreview` varchar(240) NOT NULL,
	`nextToken` text,
	`newestPostId` varchar(64),
	`exhausted` enum('no','yes') NOT NULL DEFAULT 'no',
	`lastSyncedAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastError` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitor_query_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitor_query_state_unique` UNIQUE(`monitorId`,`familyId`,`queryHash`)
);
--> statement-breakpoint
CREATE TABLE `monitor_sync_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monitorId` int NOT NULL,
	`familyId` varchar(48) NOT NULL,
	`queryHash` varchar(64) NOT NULL,
	`pageNumber` int NOT NULL,
	`source` enum('filtered_stream','recent_search','twitterapi_io','demo') NOT NULL DEFAULT 'twitterapi_io',
	`status` enum('healthy','degraded','rate_limited','payment_required','error') NOT NULL,
	`rawReceived` int NOT NULL DEFAULT 0,
	`deduplicatedPosts` int NOT NULL DEFAULT 0,
	`buyerCandidates` int NOT NULL DEFAULT 0,
	`persistedPosts` int NOT NULL DEFAULT 0,
	`queueWaitMs` int NOT NULL DEFAULT 0,
	`durationMs` int NOT NULL DEFAULT 0,
	`error` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitor_sync_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `monitor_query_state_monitor_idx` ON `monitor_query_states` (`monitorId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `monitor_sync_run_monitor_idx` ON `monitor_sync_runs` (`monitorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `monitor_sync_run_family_idx` ON `monitor_sync_runs` (`monitorId`,`familyId`,`createdAt`);