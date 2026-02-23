PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_require_completed_predecessors_on_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_require_completed_predecessors_on_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_set_updated_at`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `todo_dependencies_require_completed_predecessors_for_completed_successor_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `todo_dependencies_require_completed_predecessors_for_completed_successor_update`;--> statement-breakpoint
CREATE TABLE `__new_todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`tag_id` integer,
	`status` text DEFAULT 'todo' NOT NULL,
	`input_artifacts` text,
	`output_artifacts` text,
	`work_notes` text,
	`priority` integer,
	`due_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "todos_status_check" CHECK("__new_todos"."status" in ('todo', 'in_progress', 'completed')),
	CONSTRAINT "todos_priority_range_check" CHECK("__new_todos"."priority" is null or ("__new_todos"."priority" between 1 and 5))
);
--> statement-breakpoint
INSERT INTO `__new_todos`("id", "description", "tag_id", "status") SELECT "id", "description", "tag_id", "status" FROM `todos`;--> statement-breakpoint
DROP TABLE `todos`;--> statement-breakpoint
ALTER TABLE `__new_todos` RENAME TO `todos`;--> statement-breakpoint
CREATE TRIGGER `todos_require_completed_predecessors_on_insert`
BEFORE INSERT ON `todos`
FOR EACH ROW
WHEN NEW.status = 'completed'
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM todo_dependencies d
        JOIN todos p ON p.id = d.predecessor_id
        WHERE d.successor_id = NEW.id
          AND p.status != 'completed'
      )
      THEN RAISE(ABORT, 'cannot complete todo with incomplete predecessors')
    END;
END;--> statement-breakpoint
CREATE TRIGGER `todos_require_completed_predecessors_on_update`
BEFORE UPDATE OF `status` ON `todos`
FOR EACH ROW
WHEN NEW.status = 'completed'
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM todo_dependencies d
        JOIN todos p ON p.id = d.predecessor_id
        WHERE d.successor_id = NEW.id
          AND p.status != 'completed'
      )
      THEN RAISE(ABORT, 'cannot complete todo with incomplete predecessors')
    END;
END;--> statement-breakpoint
CREATE TRIGGER `todos_set_updated_at`
AFTER UPDATE ON `todos`
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE todos
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;--> statement-breakpoint
CREATE TRIGGER `todo_dependencies_require_completed_predecessors_for_completed_successor_insert`
BEFORE INSERT ON `todo_dependencies`
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM todos s
        JOIN todos p ON p.id = NEW.predecessor_id
        WHERE s.id = NEW.successor_id
          AND s.status = 'completed'
          AND p.status != 'completed'
      )
      THEN RAISE(ABORT, 'cannot add incomplete predecessor to completed todo')
    END;
END;--> statement-breakpoint
CREATE TRIGGER `todo_dependencies_require_completed_predecessors_for_completed_successor_update`
BEFORE UPDATE OF `successor_id`, `predecessor_id` ON `todo_dependencies`
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM todos s
        JOIN todos p ON p.id = NEW.predecessor_id
        WHERE s.id = NEW.successor_id
          AND s.status = 'completed'
          AND p.status != 'completed'
      )
      THEN RAISE(ABORT, 'cannot add incomplete predecessor to completed todo')
    END;
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
