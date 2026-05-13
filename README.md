# Toph

A free, open-source voice-to-text dictation app. Think WisprFlow or Granola,
but yours to use, modify, and improve.

## Why the name Toph?

In _Avatar: The Last Airbender_, [Toph](https://avatar.fandom.com/wiki/Toph_Beifong) is the blind earthbender who "sees" the
world through vibrations — every footstep, every heartbeat, every lie. She
doesn't need eyes; she just listens to the ground.

That felt like the right vibe for a dictation app. Toph hears what you say and
gives it shape, while staying invisibly out of the way until you need it.

(Also: short, memorable, not a stretched acronym. We're not sorry.)

## What Toph is built around

A few stubborn principles, in rough order of stubbornness:

1. **Bring your own subscription.** If you're already paying for ChatGPT (or
   whatever AI you've sworn loyalty to), Toph should just use that. No second
   meter running.
2. **Auto-edit like it cares.** Dictation that ships with `um`s, false starts,
   and "wait, actually..." trails is just transcription. Toph cleans up after
   you so the output reads like you meant to say it.
3. **No rant left behind.** Ramble for an hour straight and it should Just
   Work — no silent timeouts, no chunk limits, no "please speak in shorter
   bursts."
4. **Open source, in your hands.** Yours to read, fork, extend, embed. If you
   don't like how something works, the code is right there — go fix it.

## Getting started

Head over to the [latest release](https://github.com/YourTechBudStudio/Toph/releases/latest)
and grab the installer for your platform. Open it, install it, start talking.

## Want to get your hands dirty?

Building from source is two commands:

```bash
pnpm install
pnpm build
pnpm start
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
