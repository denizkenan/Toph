import { resolveShortcutPresetForPlatform } from '@toph/desktop-contracts';

describe('shortcut presets', () => {
  it('resolves the primary toggle shortcut for macOS', () => {
    const preset = resolveShortcutPresetForPlatform('toggle-dictation-primary', 'darwin');

    expect(preset.accelerator).toBe('Control+Option+Space');
    expect(preset.label).toBe('Ctrl+Option+Space');
  });

  it('keeps the primary toggle shortcut unchanged on Linux', () => {
    const preset = resolveShortcutPresetForPlatform('toggle-dictation-primary', 'linux');

    expect(preset.accelerator).toBe('CommandOrControl+Alt+Space');
    expect(preset.label).toBe('Ctrl+Alt+Space');
    expect(preset.gnomeBinding).toBe('<Primary><Alt>space');
  });
});
