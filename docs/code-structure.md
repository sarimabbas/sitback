# Code Structure

```mermaid
flowchart TD
  subgraph CLI[src/index.ts]
    CInit[initializeDatabase]
    CAssert[assertDatabaseInitialized]
    CRoot[build root Command + parse]
    CTodo[createTodoCommand]
    CTag[createTagCommand]
    CExport[createExportCommand]
    CInitCmd[createInitCommand]
  end

  subgraph Commands[src/commands/*]
    CmdTodoShell[src/commands/todos/command.ts]
    CmdTagShell[src/commands/tags/command.ts]
    CmdExportShell[src/commands/export/command.ts]
    CmdInitShell[src/commands/init/command.ts]
    CmdAdd[runAddCommand]
    CmdClaim[runClaimCommand]
    CmdDelete[runDeleteCommand]
    CmdUpdate[runUpdateCommand]
    CmdGet[runGetCommand]
    CmdTagAdd[runTagAddCommand]
    CmdTagGet[runTagGetCommand]
    CmdTagUpdate[runTagUpdateCommand]
    CmdTagDelete[runTagDeleteCommand]
    CmdExport[runExportCommand]
    CmdInit[runInitCommand]
    CmdShared[parsePositiveInteger / parsePriority]
    CmdTypes[dateYmdType / tagPathType]
    CmdMarkdown[toMarkdown / renderTagMarkdown / renderTodoMarkdown]
  end

  subgraph DBBun[src/db/bun.ts + src/db/pragmas.ts]
    DEnsure[ensureConfigDir]
    DPragma[applySqlitePragmas]
    DBun[db bun-sqlite]
  end

  subgraph DBWeb[src/db/web.ts]
    DWDb[db better-sqlite3]
  end

  subgraph DBLifecycle[src/db/lifecycle.ts]
    DLResolve[resolveMigrationsFolder]
    DLInit[initializeDatabase]
    DLRunMig[runMigrations]
    DLAssert[assertDatabaseInitialized]
  end

  subgraph DevScripts[scripts/db-squash.ts]
    SSql[removeFilesInDirectory]
    SGen[drizzle-kit generate]
    SAppend[appendCustomMigrationSql]
    SMigrate[drizzle-kit migrate]
  end

  subgraph Schema[src/db/schema.ts]
    STags[tagsTable]
    STodos[todosTable]
    SDeps[todoDependenciesTable]
  end

  subgraph QIndex[src/db/queries/index.ts]
    QBarrel[re-export query modules]
  end

  subgraph QTodos[src/db/queries/todos.ts]
    QTSelect[todosWithBlockedSelection]
    QTMap[mapBlocked]
    QTBlockedExpr[blockedExistsSql]
    QTCreate[createTodo]
    QTGetById[getTodoById]
    QTGetAll[getTodos]
    QTUpdate[updateTodo]
    QTDelete[deleteTodo]
    QTReady[getReadyTodos]
    QTByIds[getTodosByIds]
    QTNext[getNextTodos]
    QTClaim[claimTodo]
    QTForGet[getTodosForGet]
    QTAdd[addTodo]
    QTUpdateRel[updateTodoWithRelations]
    QTSort[compareTodosForScheduling]
  end

  subgraph QTags[src/db/queries/tags.ts]
    QGCreate[createTag]
    QGById[getTagById]
    QGAll[getTags]
    QGAllSummary[getAllTagsSummary]
    QGResolve[resolveTagPath]
    QGSummary[getTagSummary]
    QGUpdate[updateTag]
    QGDelete[deleteTag]
    QGPath[ensureTagPath]
    QGFind[findTagByNameAndParent]
    QGNorm[normalizeTagPath]
  end

  subgraph QDeps[src/db/queries/dependencies.ts]
    QDAdd[addDependency]
    QDReplace[replaceTodoPredecessors]
  end

  subgraph QExport[src/db/queries/export.ts]
    QEGet[getExportTree]
    QEBuildTags[tagNodes + sortTagTree]
    QEBuildTodos[todoNodes + dependency tree]
  end

  Migrations[drizzle/*.sql\nDDL + constraints + triggers]
  Tests[test/db.test.ts + test/commands/add.test.ts + test/commands/claim.test.ts + test/commands/update.test.ts + test/commands/delete.test.ts + test/commands/get.test.ts + test/commands/tag.test.ts\nintegration tests]

  CInit --> DLInit
  CAssert --> DLAssert
  CRoot --> CTodo
  CRoot --> CTag
  CRoot --> CExport
  CRoot --> CInitCmd
  CTodo --> CmdTodoShell
  CTag --> CmdTagShell
  CExport --> CmdExportShell
  CInitCmd --> CmdInitShell
  CmdTodoShell --> CmdAdd
  CmdTodoShell --> CmdClaim
  CmdTodoShell --> CmdGet
  CmdTodoShell --> CmdUpdate
  CmdTodoShell --> CmdDelete
  CmdTagShell --> CmdTagAdd
  CmdTagShell --> CmdTagGet
  CmdTagShell --> CmdTagUpdate
  CmdTagShell --> CmdTagDelete
  CmdExportShell --> CmdExport
  CmdInitShell --> CmdInit

  DLInit --> DPragma
  DLInit --> DEnsure
  DLRunMig --> DLResolve
  DLAssert --> DLResolve
  CmdInit --> DLRunMig
  DLRunMig --> Migrations

  SSql --> SGen
  SGen --> SAppend
  SAppend --> SMigrate
  SAppend --> Migrations

  CmdAdd --> CmdShared
  CmdAdd --> CmdTypes
  CmdClaim --> CmdShared
  CmdUpdate --> CmdShared
  CmdUpdate --> CmdTypes
  CmdDelete --> CmdShared
  CmdGet --> CmdShared
  CmdGet --> CmdTypes
  CmdTagAdd --> CmdTypes
  CmdTagGet --> CmdShared
  CmdTagUpdate --> CmdShared
  CmdTagDelete --> CmdShared
  CmdExport --> CmdMarkdown

  CmdAdd --> QTAdd
  CmdClaim --> QTClaim
  CmdUpdate --> QTUpdate
  CmdUpdate --> QTUpdateRel
  CmdUpdate --> QGResolve
  CmdUpdate --> QGById
  CmdDelete --> QTDelete
  CmdTagAdd --> QGPath
  CmdTagGet --> QGAllSummary
  CmdTagGet --> QGSummary
  CmdTagUpdate --> QGUpdate
  CmdTagDelete --> QGDelete
  CmdTagDelete --> QGById
  QTAdd --> QTCreate
  QTAdd --> QTGetById
  QTAdd --> QDAdd
  QTAdd --> QGPath
  QTUpdateRel --> QTUpdate
  QTUpdateRel --> QTGetById
  QTUpdateRel --> QDReplace

  CmdGet --> QTByIds
  CmdGet --> QTForGet
  CmdGet --> QGResolve
  CmdGet --> QGById
  QTForGet --> QTSelect
  QTByIds --> QTSelect
  QTGetById --> QTSelect
  QTGetAll --> QTSelect
  QTSelect --> QTBlockedExpr
  QTSelect --> QTMap
  QTForGet --> QTSort
  QTClaim --> QTGetById
  QTClaim --> QTSort
  QTNext --> QTForGet

  CmdExport --> QEGet
  QEGet --> QGAll
  QEGet --> QTGetAll
  QEGet --> QEBuildTags
  QEGet --> QEBuildTodos

  QTCreate --> STodos
  QTGetById --> STodos
  QTGetAll --> STodos
  QTUpdate --> STodos
  QTDelete --> STodos
  QTReady --> STodos
  QTBlockedExpr --> SDeps
  QTBlockedExpr --> STodos
  QGCreate --> STags
  QGById --> STags
  QGAll --> STags
  QGUpdate --> STags
  QGDelete --> STags
  QDAdd --> SDeps
  QDReplace --> SDeps

  QBarrel --> QTodos
  QBarrel --> QTags
  QBarrel --> QDeps
  QBarrel --> QExport

  Tests --> DLInit
  Tests --> CmdInit
  Tests --> QTodos
  Tests --> QTags
  Tests --> QDeps
  Tests --> QExport
  Tests --> Migrations
```

## Notes

- Cliffy root setup and parse flow live directly in `src/index.ts`.
- `sb init` is the explicit migration entrypoint; normal command execution checks migration state first.
- Commands are grouped by domain under `src/commands/todos/*`, `src/commands/tags/*`, and `src/commands/export/*`.
- Shared CLI option parsing/validation is centralized in `src/commands/shared.ts`.
- Cliffy option primitives (`required`, `default`, built-in types, and enum/custom types) are preferred for CLI parsing and help metadata, with `shared.ts` reserved for domain-specific validators.
- Scheduling behavior is centralized in `compareTodosForScheduling` and reused by `getNextTodos`/`getTodosForGet`.
- Todo blocked-state selection is centralized in `todosWithBlockedSelection` and reused by `getTodoById`/`getTodos`/`getTodosByIds`/`getTodosForGet`.
- Tag path upsert is centralized in `ensureTagPath` and reused by `addTodo`.
- Migration SQL (`drizzle/*.sql`) is applied by `sb init` (via `runMigrations`), not by default command startup.
- `@sitback/db` exposes explicit runtime entrypoints: `@sitback/db/bun` (Bun SQLite for CLI/binary usage) and `@sitback/db/web` (better-sqlite3 for web server runtime), with shared lifecycle helpers in `@sitback/db/lifecycle`.
- Web todo demo data plumbing is now split into `packages/web/src/server/todos.ts` (server functions for fetch/create/status update) and `packages/web/src/db-collections/todos.ts` (TanStack DB Query Collection with polling refetch plus optimistic status persistence), consumed by `packages/web/src/routes/demo/drizzle.tsx` via `useLiveQuery`.
- Multi-agent orchestration guidance lives in `skills/sitback-session-memory/SKILL.md`; it uses direct `sb todo add/update` patterns for planner/worker checkpoints, DAG dependencies, and bounded parallelism.
