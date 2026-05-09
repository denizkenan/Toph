The open-source and free alternative to WisprFlow and Granola.

## Desktop Database Migrations

After changing `apps/desktop/src/main/db/schema.ts`, generate a migration with `pnpm --filter @toph/desktop exec drizzle-kit generate`.

Never edit files in `apps/desktop/drizzle`; they are generated migrations.
