# Assets

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
