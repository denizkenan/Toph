# Assets

The Toph logo, icon, wordmark, and related brand assets are not licensed under
the repository's Apache-2.0 code license. See `../TRADEMARKS.md` for brand usage
rules.

`logo.png` is the source for the packaged app icons. Generated outputs live in
`app-icons/` and are used by Electron Builder for macOS, Windows, and Linux.
The generated macOS `.icns` and `icon-mac.png` center the logo inside an
`832x832` artwork safe area on a `1024x1024` canvas so it has
platform-appropriate padding in the Dock and Finder.
The `.icns` includes the standard 1x and 2x macOS icon representations from 16px
through 1024px.

Regenerate the app icons from `logo.png` when the logo source changes:

```sh
pnpm run icons:app
```

`tray-icon.svg` is the source for the monochrome system tray icons.

The tray PNGs are generated variants used by Electron:

- `tray-iconTemplate.png` and `tray-iconTemplate@2x.png`: black template images for macOS.
- `tray-icon-light.png` and `tray-icon-light@2x.png`: black icons for light tray backgrounds on Windows and Linux.
- `tray-icon-dark.png` and `tray-icon-dark@2x.png`: white icons for dark tray backgrounds on Windows and Linux.

Regenerate the PNGs from `tray-icon.svg` when the source SVG changes:

```sh
pnpm run icons:tray
```

Keep the 1x files at `18x18` and the `@2x` files at `36x36`.

`logo-concept.png` and `tray-icon-box.svg` are design references and are not currently loaded by the app.
