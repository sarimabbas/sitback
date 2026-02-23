PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
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
