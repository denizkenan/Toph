import {
  formatShortcutChord,
  resolveDefaultShortcutChord,
  shortcutChordToElectronAccelerator,
  shortcutChordToGnomeBinding,
  validateShortcutCandidate,
} from '@toph/desktop-contracts';

describe('shortcut chords', () => {
  it('resolves the default shortcut for macOS', () => {
    const chord = resolveDefaultShortcutChord('darwin');

    expect(shortcutChordToElectronAccelerator(chord, 'darwin')).toBe('Control+Option+Space');
    expect(formatShortcutChord(chord, 'darwin')).toBe('⌃⌥Space');
  });

  it('resolves the default shortcut for Linux', () => {
    const chord = resolveDefaultShortcutChord('linux');

    expect(shortcutChordToElectronAccelerator(chord, 'linux')).toBe('Control+Alt+Space');
    expect(formatShortcutChord(chord, 'linux')).toBe('Ctrl+Alt+Space');
    expect(shortcutChordToGnomeBinding(chord)).toBe('<Primary><Alt>space');
  });

  it('maps Enter to the GNOME accelerator name', () => {
    expect(shortcutChordToGnomeBinding({ modifiers: ['control'], key: 'Enter' })).toBe('<Primary>Return');
  });

  it('allows function keys without modifiers', () => {
    const result = validateShortcutCandidate({ modifiers: [], keys: ['F15'] });

    expect(result.valid).toBe(true);
  });

  it('rejects multiple main keys', () => {
    const result = validateShortcutCandidate({ modifiers: ['control'], keys: ['Space', 'K'] });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('only use one main key');
  });

  it('rejects unsupported key names at the contract boundary', () => {
    const result = validateShortcutCandidate({ modifiers: ['control'], keys: ['NotARealKey'] });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('not supported');
  });
});
