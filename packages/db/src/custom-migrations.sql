-- Canonical custom SQL for triggers and migration-only logic.
-- Copy relevant statements from this file into custom/rebuild migrations.

DROP TRIGGER IF EXISTS `todo_dependencies_no_cycles_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `todo_dependencies_no_cycles_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `todo_dependencies_require_completed_predecessors_for_completed_successor_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `todo_dependencies_require_completed_predecessors_for_completed_successor_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_require_completed_predecessors_on_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_require_completed_predecessors_on_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `todos_set_updated_at`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `tags_no_cycles_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `tags_no_cycles_update`;
--> statement-breakpoint

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
END;
--> statement-breakpoint

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
END;
--> statement-breakpoint

CREATE TRIGGER `tags_no_cycles_insert`
BEFORE INSERT ON `tags`
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
BEGIN
  WITH RECURSIVE ancestors(id) AS (
    SELECT NEW.parent_id
    UNION
    SELECT t.parent_id
    FROM tags t
    JOIN ancestors a ON t.id = a.id
    WHERE t.parent_id IS NOT NULL
  )
  SELECT
    CASE
      WHEN NEW.id IS NOT NULL AND EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id)
      THEN RAISE(ABORT, 'tag cycle detected')
    END;
END;
--> statement-breakpoint

CREATE TRIGGER `tags_no_cycles_update`
BEFORE UPDATE OF `parent_id` ON `tags`
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
BEGIN
  WITH RECURSIVE ancestors(id) AS (
    SELECT NEW.parent_id
    UNION
    SELECT t.parent_id
    FROM tags t
    JOIN ancestors a ON t.id = a.id
    WHERE t.parent_id IS NOT NULL
  )
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id)
      THEN RAISE(ABORT, 'tag cycle detected')
    END;
END;
--> statement-breakpoint

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
END;
--> statement-breakpoint

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
END;
--> statement-breakpoint

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
END;
--> statement-breakpoint

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
END;
--> statement-breakpoint

CREATE TRIGGER `todos_set_updated_at`
AFTER UPDATE ON `todos`
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE todos
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
