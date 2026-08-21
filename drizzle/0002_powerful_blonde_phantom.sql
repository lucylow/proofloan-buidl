CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` varchar(64) NOT NULL,
	`state` varchar(32) NOT NULL,
	`label` varchar(64) NOT NULL,
	`detail` text NOT NULL,
	`eventHash` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_events_eventHash_unique` UNIQUE(`eventHash`)
);
