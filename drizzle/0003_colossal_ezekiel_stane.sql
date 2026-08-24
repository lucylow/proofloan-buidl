CREATE TABLE `acceptance_idempotency` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` varchar(64) NOT NULL,
	`requestKey` varchar(128) NOT NULL,
	`status` varchar(16) NOT NULL,
	`resultJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `acceptance_idempotency_id` PRIMARY KEY(`id`),
	CONSTRAINT `acceptance_idempotency_applicationId_unique` UNIQUE(`applicationId`)
);
