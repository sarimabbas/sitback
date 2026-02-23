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
