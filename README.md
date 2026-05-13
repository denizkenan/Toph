The open-source and free alternative to WisprFlow and Granola.

## Desktop Native Modules

The desktop app uses native dependencies such as `better-sqlite3`, which must be compiled against Electron's embedded Node.js runtime. `pnpm build` runs `pnpm --filter @toph/desktop run rebuild:native` automatically before building.

Run `pnpm --filter @toph/desktop run rebuild:native` manually after changing Electron, Node.js, or native dependencies if the app fails to bootstrap with a `NODE_MODULE_VERSION` mismatch.

## Desktop Database Migrations

After changing `apps/desktop/src/main/db/schema.ts`, generate a migration with `pnpm --filter @toph/desktop exec drizzle-kit generate`.

Never edit files in `apps/desktop/drizzle`; they are generated migrations.

## License

Toph source code is licensed under the Apache License, Version 2.0. See
`LICENSE` and `NOTICE` for details.

The Toph name, logo, icon, wordmark, and related brand assets are not licensed
under Apache-2.0. See `TRADEMARKS.md` for brand usage rules.
