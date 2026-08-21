CREATE TABLE `decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` varchar(64) NOT NULL,
	`pd30` decimal(8,5) NOT NULL,
	`pd90` decimal(8,5) NOT NULL,
	`confidence` decimal(8,5) NOT NULL,
	`riskTier` varchar(8) NOT NULL,
	`reasonCodes` text NOT NULL,
	`featureVersion` varchar(128) NOT NULL,
	`modelVersion` varchar(128) NOT NULL,
	`policyHash` varchar(128) NOT NULL,
	`evidenceRoot` varchar(128) NOT NULL,
	`decisionHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loan_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` varchar(64) NOT NULL,
	`borrowerOpenId` varchar(64),
	`walletAddress` varchar(128) NOT NULL,
	`sourceChain` varchar(48) NOT NULL,
	`state` varchar(32) NOT NULL,
	`requestedAmount` decimal(18,2) NOT NULL,
	`evidenceRoot` varchar(128),
	`policyHash` varchar(128),
	`modelVersion` varchar(128),
	`decisionHash` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loan_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `loan_applications_applicationId_unique` UNIQUE(`applicationId`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` varchar(64) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`apr` decimal(8,3) NOT NULL,
	`ltv` decimal(8,5) NOT NULL,
	`termDays` int NOT NULL,
	`status` varchar(16) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verified_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`factId` varchar(64) NOT NULL,
	`applicationId` varchar(64) NOT NULL,
	`chain` varchar(48) NOT NULL,
	`sourceBlock` int NOT NULL,
	`txHash` varchar(128) NOT NULL,
	`eventType` varchar(48) NOT NULL,
	`amount` varchar(64) NOT NULL,
	`verificationBlock` int NOT NULL,
	`freshness` varchar(16) NOT NULL,
	`proofRoot` varchar(128) NOT NULL,
	`verifiedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verified_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `verified_facts_factId_unique` UNIQUE(`factId`)
);
