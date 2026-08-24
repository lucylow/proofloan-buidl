CREATE TABLE `proof_request_idempotency` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestKey` varchar(128) NOT NULL,
	`walletAddress` varchar(128) NOT NULL,
	`sourceChain` varchar(48) NOT NULL,
	`applicationId` varchar(64),
	`status` varchar(16) NOT NULL,
	`resultJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proof_request_idempotency_id` PRIMARY KEY(`id`),
	CONSTRAINT `proof_request_idempotency_requestKey_unique` UNIQUE(`requestKey`)
);
