import '@fontsource/sora/500.css'
import '@fontsource/source-sans-3/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { DesktopApi } from '@toph/desktop-contracts'
import { OverlayApp } from './overlay-app'
import './styles.css'

export function mountOverlayApp(container: HTMLElement, client: DesktopApi) {
  createRoot(container).render(
    <StrictMode>
      <OverlayApp client={client} />
    </StrictMode>,
  )
}
