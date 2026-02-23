CREATE TABLE `todo_dependencies` (
	`successor_id` integer NOT NULL,
	`predecessor_id` integer NOT NULL,
	PRIMARY KEY(`successor_id`, `predecessor_id`),
	FOREIGN KEY (`successor_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`predecessor_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "todo_dependencies_not_self_check" CHECK("todo_dependencies"."successor_id" != "todo_dependencies"."predecessor_id")
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`tag_id` integer,
	`status` text DEFAULT 'todo' NOT NULL,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "todos_status_check" CHECK("__new_todos"."status" in ('todo', 'in_progress', 'completed'))
);
--> statement-breakpoint
INSERT INTO `__new_todos`("id", "description", "tag_id", "status") SELECT "id", "description", "tag_id", "status" FROM `todos`;--> statement-breakpoint
DROP TABLE `todos`;--> statement-breakpoint
ALTER TABLE `__new_todos` RENAME TO `todos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;