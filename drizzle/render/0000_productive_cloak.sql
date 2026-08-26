CREATE TABLE "hidden_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"xPostId" varchar(128) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listened_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"monitorId" integer NOT NULL,
	"xPostId" varchar(128) NOT NULL,
	"authorId" varchar(128),
	"authorHandle" varchar(80),
	"authorName" varchar(160),
	"authorAvatarUrl" varchar(2048),
	"body" text NOT NULL,
	"postUrl" varchar(1024),
	"postedAt" timestamp with time zone NOT NULL,
	"capturedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"language" varchar(24),
	"engagement" jsonb NOT NULL,
	"matchedRule" varchar(1024) NOT NULL,
	"source" varchar(16) DEFAULT 'x_api' NOT NULL,
	"ruleScore" integer DEFAULT 0 NOT NULL,
	"scoreExplanation" jsonb NOT NULL,
	"aiIntent" jsonb NOT NULL,
	"reviewStatus" varchar(16) DEFAULT 'pending' NOT NULL,
	"reviewedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "monitor_query_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"monitorId" integer NOT NULL,
	"familyId" varchar(48) NOT NULL,
	"queryHash" varchar(64) NOT NULL,
	"queryPreview" varchar(240) NOT NULL,
	"nextToken" text,
	"newestPostId" varchar(128),
	"pagesFetched" integer DEFAULT 0 NOT NULL,
	"exhausted" varchar(8) DEFAULT 'no' NOT NULL,
	"lastSyncedAt" timestamp with time zone,
	"lastSuccessAt" timestamp with time zone,
	"lastError" text,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"monitorId" integer NOT NULL,
	"familyId" varchar(48) NOT NULL,
	"queryHash" varchar(64) NOT NULL,
	"pageNumber" integer NOT NULL,
	"source" varchar(32) DEFAULT 'twitterapi_io' NOT NULL,
	"status" varchar(32) NOT NULL,
	"rawReceived" integer DEFAULT 0 NOT NULL,
	"deduplicatedPosts" integer DEFAULT 0 NOT NULL,
	"buyerCandidates" integer DEFAULT 0 NOT NULL,
	"persistedPosts" integer DEFAULT 0 NOT NULL,
	"queueWaitMs" integer DEFAULT 0 NOT NULL,
	"durationMs" integer DEFAULT 0 NOT NULL,
	"error" varchar(1000),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_syncs" (
	"id" serial PRIMARY KEY NOT NULL,
	"monitorId" integer NOT NULL,
	"source" varchar(32) DEFAULT 'recent_search' NOT NULL,
	"status" varchar(32) DEFAULT 'idle' NOT NULL,
	"latencyLabel" varchar(80) DEFAULT 'Not synced' NOT NULL,
	"newestPostId" varchar(128),
	"nextToken" text,
	"lastSyncedAt" timestamp with time zone,
	"lastSuccessAt" timestamp with time zone,
	"lastError" text,
	"lastDurationMs" integer,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitor_syncs_monitorId_unique" UNIQUE("monitorId")
);
--> statement-breakpoint
CREATE TABLE "monitoring_criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"goal" text NOT NULL,
	"xQuery" varchar(1024) NOT NULL,
	"includeTerms" jsonb NOT NULL,
	"excludeTerms" jsonb NOT NULL,
	"categories" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge" varchar(512) NOT NULL,
	"purpose" varchar(16) NOT NULL,
	"userId" integer,
	"profileName" text,
	"email" varchar(320),
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkey_challenges_challenge_unique" UNIQUE("challenge")
);
--> statement-breakpoint
CREATE TABLE "passkey_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"credentialId" varchar(1024) NOT NULL,
	"publicKey" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkey_credentials_credentialId_unique" UNIQUE("credentialId")
);
--> statement-breakpoint
CREATE TABLE "post_alert_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"postId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"userId" integer NOT NULL,
	"decision" varchar(16) NOT NULL,
	"note" varchar(1000),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"encryptedCredential" text NOT NULL,
	"credentialHint" varchar(16) NOT NULL,
	"dailyRequestLimit" integer DEFAULT 20 NOT NULL,
	"automaticCollection" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "saved_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"postId" integer NOT NULL,
	"note" varchar(1000),
	"priority" varchar(16) DEFAULT 'normal' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(191) NOT NULL,
	"name" text,
	"email" varchar(320),
	"avatarUrl" varchar(2048),
	"loginMethod" varchar(64) DEFAULT 'passkey',
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hidden_post_user_x_post_unique" ON "hidden_posts" USING btree ("userId","xPostId");--> statement-breakpoint
CREATE INDEX "hidden_post_user_created_idx" ON "hidden_posts" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "listened_post_unique" ON "listened_posts" USING btree ("monitorId","xPostId");--> statement-breakpoint
CREATE INDEX "listened_post_monitor_score_idx" ON "listened_posts" USING btree ("monitorId","ruleScore");--> statement-breakpoint
CREATE INDEX "listened_post_review_idx" ON "listened_posts" USING btree ("reviewStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "monitor_query_state_unique" ON "monitor_query_states" USING btree ("monitorId","familyId","queryHash");--> statement-breakpoint
CREATE INDEX "monitor_query_state_monitor_idx" ON "monitor_query_states" USING btree ("monitorId","updatedAt");--> statement-breakpoint
CREATE INDEX "monitor_sync_run_monitor_idx" ON "monitor_sync_runs" USING btree ("monitorId","createdAt");--> statement-breakpoint
CREATE INDEX "monitor_sync_run_family_idx" ON "monitor_sync_runs" USING btree ("monitorId","familyId","createdAt");--> statement-breakpoint
CREATE INDEX "monitoring_criteria_user_idx" ON "monitoring_criteria" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "passkey_challenge_expiry_idx" ON "passkey_challenges" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "passkey_credential_user_idx" ON "passkey_credentials" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "post_alert_user_post_unique" ON "post_alert_deliveries" USING btree ("userId","postId");--> statement-breakpoint
CREATE INDEX "post_alert_user_created_idx" ON "post_alert_deliveries" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "post_review_post_idx" ON "post_reviews" USING btree ("postId");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_post_user_post_unique" ON "saved_posts" USING btree ("userId","postId");--> statement-breakpoint
CREATE INDEX "saved_post_user_created_idx" ON "saved_posts" USING btree ("userId","createdAt");