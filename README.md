The open-source and free alternative to WisprFlow and Granola.

## Desktop Native Modules

The desktop app uses native dependencies such as `better-sqlite3`, which must be compiled against Electron's embedded Node.js runtime. `pnpm build` runs `pnpm --filter @toph/desktop run rebuild:native` automatically before building.

Run `pnpm --filter @toph/desktop run rebuild:native` manually after changing Electron, Node.js, or native dependencies if the app fails to bootstrap with a `NODE_MODULE_VERSION` mismatch.

## Desktop Database Migrations

After changing `apps/desktop/src/main/db/schema.ts`, generate a migration with `pnpm --filter @toph/desktop exec drizzle-kit generate`.

Never edit files in `apps/desktop/drizzle`; they are generated migrations.
