PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_require_completed_predecessors_on_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_require_completed_predecessors_on_update`;--> statement-breakpoint
CREATE TABLE `__new_todo_dependencies` (
	`successor_id` integer NOT NULL,
	`predecessor_id` integer NOT NULL,
	PRIMARY KEY(`successor_id`, `predecessor_id`),
	FOREIGN KEY (`successor_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`predecessor_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "todo_dependencies_not_self_check" CHECK("__new_todo_dependencies"."successor_id" != "__new_todo_dependencies"."predecessor_id")
);
--> statement-breakpoint
INSERT INTO `__new_todo_dependencies`("successor_id", "predecessor_id") SELECT "successor_id", "predecessor_id" FROM `todo_dependencies`;--> statement-breakpoint
DROP TABLE `todo_dependencies`;--> statement-breakpoint
ALTER TABLE `__new_todo_dependencies` RENAME TO `todo_dependencies`;--> statement-breakpoint
CREATE TRIGGER `todo_dependencies_no_cycles_insert`
BEFORE INSERT ON `todo_dependencies`
FOR EACH ROW
BEGIN
  WITH RECURSIVE reach(id) AS (
    SELECT NEW.successor_id
    UNION
    SELECT td.successor_id
    FROM todo_dependencies td
    JOIN reach r ON td.predecessor_id = r.id
  )
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM reach WHERE id = NEW.predecessor_id)
      THEN RAISE(ABORT, 'todo dependency cycle detected')
    END;
END;--> statement-breakpoint
CREATE TRIGGER `todo_dependencies_no_cycles_update`
BEFORE UPDATE OF `successor_id`, `predecessor_id` ON `todo_dependencies`
FOR EACH ROW
BEGIN
  WITH RECURSIVE reach(id) AS (
    SELECT NEW.successor_id
    UNION
    SELECT td.successor_id
    FROM todo_dependencies td
    JOIN reach r ON td.predecessor_id = r.id
    WHERE NOT (
      td.successor_id = OLD.successor_id
      AND td.predecessor_id = OLD.predecessor_id
    )
  )
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM reach WHERE id = NEW.predecessor_id)
      THEN RAISE(ABORT, 'todo dependency cycle detected')
    END;
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
PRAGMA foreign_keys=ON;
