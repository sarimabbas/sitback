PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tags_name_lowercase_check" CHECK("__new_tags"."name" = lower("__new_tags"."name")),
	CONSTRAINT "tags_name_not_empty_check" CHECK(length("__new_tags"."name") > 0),
	CONSTRAINT "tags_name_alphanumeric_check" CHECK("__new_tags"."name" not glob '*[^a-z0-9]*')
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "name", "parent_id") SELECT "id", "name", "parent_id" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_parent_name_unique` ON `tags` (`parent_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_root_name_unique` ON `tags` (`name`) WHERE "tags"."parent_id" is null;