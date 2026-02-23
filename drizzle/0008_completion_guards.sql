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
