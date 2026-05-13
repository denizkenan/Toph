# Toph

A free, open-source voice-to-text dictation app. Think WisprFlow or Granola,
but yours to use, modify, and improve.

## Getting started

```bash
pnpm install
pnpm build
```

That's it. The build step takes care of compiling native modules against
Electron automatically.

## Development notes

**Native modules** — The desktop app depends on `better-sqlite3`, which needs
to be compiled against Electron's Node.js runtime. This happens automatically
during `pnpm build`. If you change Electron, Node.js, or native dependency
versions and the app fails with a `NODE_MODULE_VERSION` mismatch, run:

```bash
pnpm --filter @toph/desktop run rebuild:native
```

**Database migrations** — After changing the schema in
`apps/desktop/src/main/db/schema.ts`, generate a migration with:

```bash
pnpm --filter @toph/desktop exec drizzle-kit generate
```

Don't edit files in `apps/desktop/drizzle` directly — those are generated.

## License

Toph source code is licensed under Apache 2.0. See `LICENSE` and `NOTICE` for
details.

The Toph name and logo aren't covered by that license — see `TRADEMARKS.md`
for the short version (it's friendly, we promise).
