CREATE TABLE `alertSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`riskThreshold` int NOT NULL DEFAULT 70,
	`cooldownMinutes` int NOT NULL DEFAULT 30,
	`notificationsEnabled` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `floodAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`regionId` varchar(64) NOT NULL,
	`regionNameEn` varchar(128) NOT NULL,
	`regionNameAr` varchar(128) NOT NULL,
	`alertLevel` enum('watch','warning','critical') NOT NULL,
	`floodRisk` int NOT NULL,
	`precipitation` varchar(32) NOT NULL DEFAULT '0',
	`notified` int NOT NULL DEFAULT 0,
	`acknowledged` int NOT NULL DEFAULT 0,
	`acknowledgedAt` timestamp,
	`lat` varchar(32) NOT NULL DEFAULT '0',
	`lon` varchar(32) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `floodAlerts_id` PRIMARY KEY(`id`)
);
