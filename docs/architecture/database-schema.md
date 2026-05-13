# Database Schema

## Purpose

This document records where Toph's local database implementation lives. It intentionally does not duplicate the schema in Markdown; the Drizzle schema is the source of truth.

## Storage

Toph stores local app data under the resolved data directory:

```text
TOPH_DATA_DIRECTORY, when set
$HOME/.toph, otherwise
```

The SQLite database file is:

```text
<dataDirectory>/data.db
```

Raw recordings are stored under:

```text
<dataDirectory>/recordings/
```

Data directory resolution lives in `apps/desktop/src/main/paths.ts`.

## Implementation

- SQLite driver: `better-sqlite3`
- Drizzle schema: `apps/desktop/src/main/db/schema.ts`
- Runtime store and migration wiring: `apps/desktop/src/main/stores/session-store.ts`
- Runtime migration folder resolution: `apps/desktop/src/main/bootstrap.ts`
- Drizzle Kit config: `apps/desktop/drizzle.config.ts`
- Generated migrations: `apps/desktop/drizzle/`

## Ownership

The desktop main process owns database access. Renderer code should use explicit desktop contracts rather than reading or writing SQLite directly.
