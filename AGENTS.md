# Agents Guide

## Runtime and tooling

- Use Bun as the default runtime and package manager.
- Prefer `bun <file>`, `bun run <script>`, `bun install`, and `bunx <tool>`.
- For workspace scripts, use `bun --filter '<workspace-name-or-glob>' <script>`.
  - `--filter` accepts a glob pattern and runs matching workspace packages concurrently while respecting dependency order.
  - Example: `bun --filter 'lib-*' my-script`
- Use `bun -e "..."` for quick ad-hoc one-liners when you need to inspect runtime behavior or test tiny snippets.
- Keep `docs/code-structure.md` in sync whenever functions are added, removed, renamed, or moved.
- After updating the diagram, validate it by rendering with Mermaid CLI:
  - `bunx @mermaid-js/mermaid-cli -i docs/code-structure.md -o /tmp/sitback-code-structure.svg`

## CLI architecture

- Prefer Bun-native APIs when practical (`Bun.serve`, `Bun.file`, Bun SQL/Redis APIs).
- Keep TypeScript strict; run `bun --filter '@sitback/cli' lint` and `bun --filter '@sitback/cli' test` for verification.
- Useful manual CLI smoke test for add command:
  - `SITBACK_CONFIG_DIR="/tmp/sitback-add-extra" bun --filter '@sitback/cli' run src/index.ts todo add --description "compile report" --status todo --priority 2 --due-date 2031-04-15 --work-notes "Investigate flaky step"`
- Do not add `dotenv` bootstrap code in the CLI; Bun loads `.env` automatically.
- Prefer Cliffy primitives over custom parsing/validation in action handlers.
- Use option metadata first:
  - `required: true` for mandatory options.
  - `default` and `defaultText` for default behavior and help display.
  - Built-in types (`boolean`, `integer`, `number`, `file`, `secret`) where applicable.
  - List types (`<value:type[]>`) for comma-separated inputs (for example ID lists), instead of manual `split(",")` parsing.
  - `EnumType`/custom `.type(...)` for constrained or structured value sets (for example formats/status values, date strings, slash paths).
- For nullable fields, prefer explicit clear flags over sentinel strings:
  - Use `--field <value>` to set.
  - Use `--clear-field` to unset.
  - If both are provided, document precedence in help text (for example `--clear-field` takes precedence).
- Keep command handlers focused on domain rules that Cliffy cannot express (for example positive integer constraints, cross-option constraints, DB existence checks).
- Avoid duplicating "missing required" or enum validation errors in handler code when Cliffy already guarantees them.
- If parser defaults affect warning behavior, detect whether a flag was explicitly passed (for example via `this.getRawArgs()`) before emitting "ignored option" warnings.

## SQLite database architecture

- Triggers do **not** need to be recreated for every migration.
- Recreate triggers when a migration rebuilds, drops, or renames a table they depend on.
- Risk pattern: SQLite rebuild migrations using `__new_*` table, copy, drop old, rename new.
- For rebuild migrations, drop affected triggers before table swap and recreate them after rename.
- Canonical trigger/custom SQL lives in `src/custom-migrations.sql`.
- Preserve trigger/custom migration logic by copying the relevant SQL blocks from `src/custom-migrations.sql` into each custom Drizzle migration that touches affected tables.
- Use `bun run db:squash` only when the developer explicitly asks for it during local development setup and you intentionally want to reset migration history to a new baseline.
- `db:squash` rewrites migration history, generates a fresh baseline migration, appends `src/custom-migrations.sql` into that new migration, and runs migrate.
- Do **not** use `db:squash` on shared/staging/production databases or after migrations are already distributed to other environments.
- After migration edits, run:
  - `bun --filter '@sitback/cli' lint`
  - `bun --filter '@sitback/cli' test`
- The DAG guarantees for todos/tags rely on triggers (cycle prevention and completion guards). If triggers are not recreated after table rebuilds, those protections can be lost.

## Frontend architecture

- This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.
  - To add a new route to your application just add a new file in the `./src/routes` directory.
  - TanStack will automatically generate the content of the route file for you.
  - Now that you have two routes you can use a `Link` component to navigate between them.
- In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

- TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'
const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

- You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

- There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

```tsx
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

- Use the latest version of Shadcn to install new components, like this command to add a button component:

```bash
bunx shadcn@latest add button
```
