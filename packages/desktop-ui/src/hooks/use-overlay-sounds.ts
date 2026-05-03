import { useEffect } from 'react';

import { type DesktopApi, type SoundEventKind } from '@toph/desktop-contracts';

function playTone(kind: SoundEventKind) {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const audioContext = new AudioContextCtor();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  const frequencies: Record<SoundEventKind, number[]> = {
    start: [494],
    stop: [392],
    done: [587, 784],
  };

  oscillator.type = kind === 'done' ? 'triangle' : 'sine';
  oscillator.frequency.value = frequencies[kind][0];
  gainNode.gain.value = 0.0001;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const now = audioContext.currentTime;
  gainNode.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  oscillator.start(now);

  if (kind === 'done') {
    oscillator.frequency.setValueAtTime(frequencies.done[0], now);
    oscillator.frequency.linearRampToValueAtTime(frequencies.done[1], now + 0.12);
  }

  oscillator.stop(now + 0.22);
  oscillator.onended = () => {
    void audioContext.close();
  };
}

export function useOverlaySounds(client: DesktopApi, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    return client.onSoundEvent((kind) => {
      playTone(kind);
    });
  }, [client, enabled]);
}
