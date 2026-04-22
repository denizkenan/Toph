import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_SHORTCUT_PRESET } from '@shared/contracts'
import type { AppState, SoundEventKind } from '@shared/contracts'

const fallbackState: AppState = {
  phase: 'idle',
  shortcut: {
    presetId: DEFAULT_SHORTCUT_PRESET.id,
    accelerator: DEFAULT_SHORTCUT_PRESET.accelerator,
    label: DEFAULT_SHORTCUT_PRESET.label,
    registered: false,
    backend: 'electron-global-shortcut',
    detail: 'Inspecting global shortcut support...',
    installable: false,
    installed: false,
  },
  environment: {
    platform: 'linux',
    sessionType: 'unknown',
    currentDesktop: 'unknown',
  },
  pasteSupport: {
    helper: null,
    detail: 'Inspecting desktop capabilities...',
  },
  lastPasteAttempt: {
    helper: null,
    status: 'idle',
    detail: 'No transcript has been pasted yet.',
  },
  lastTranscript: null,
  recentConversions: [],
  updatedAt: Date.now(),
}

export function useDesktopState() {
  const [state, setState] = useState<AppState>(fallbackState)

  useEffect(() => {
    let isMounted = true

    void window.toph.getState().then((snapshot) => {
      if (isMounted) {
        setState(snapshot)
      }
    })

    const unsubscribe = window.toph.onStateChange((snapshot) => {
      setState(snapshot)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return state
}

function playTone(kind: SoundEventKind) {
  if (typeof window === 'undefined') {
    return
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) {
    return
  }

  const audioContext = new AudioContextCtor()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  const frequencies: Record<SoundEventKind, number[]> = {
    start: [494],
    stop: [392],
    done: [587, 784],
  }

  oscillator.type = kind === 'done' ? 'triangle' : 'sine'
  oscillator.frequency.value = frequencies[kind][0]
  gainNode.gain.value = 0.0001

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  const now = audioContext.currentTime
  gainNode.gain.exponentialRampToValueAtTime(0.045, now + 0.02)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

  oscillator.start(now)

  if (kind === 'done') {
    oscillator.frequency.setValueAtTime(frequencies.done[0], now)
    oscillator.frequency.linearRampToValueAtTime(frequencies.done[1], now + 0.12)
  }

  oscillator.stop(now + 0.22)
  oscillator.onended = () => {
    void audioContext.close()
  }
}

export function useOverlaySounds(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return
    }

    return window.toph.onSoundEvent((kind) => {
      playTone(kind)
    })
  }, [enabled])
}

export function useDerivedStatus(state: AppState) {
  return useMemo(() => {
    const lastUpdated = new Date(state.updatedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    return {
      lastUpdated,
      shortcutStatus: state.shortcut.registered ? 'ready' : 'blocked',
      shortcutBackendTone: state.shortcut.backend === 'gnome-custom-shortcut' ? 'muted' : 'idle',
      pasteStatusTone:
        state.lastPasteAttempt.status === 'success'
          ? 'good'
          : state.lastPasteAttempt.status === 'failed'
            ? 'warn'
            : state.lastPasteAttempt.status === 'clipboard-only'
              ? 'muted'
              : 'idle',
    }
  }, [state])
}
