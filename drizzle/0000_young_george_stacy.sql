CREATE TABLE `todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`predecessor_id` integer,
	`status` text DEFAULT 'todo' NOT NULL,
	FOREIGN KEY (`predecessor_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "todos_status_check" CHECK("todos"."status" in ('todo', 'in_progress', 'completed'))
);
