import '@fontsource/sora/400.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import type { DesktopApi } from '@toph/desktop-contracts';

import { SettingsApp } from './settings-app';

import './styles.css';

export function mountSettingsApp(container: HTMLElement, client: DesktopApi) {
  createRoot(container).render(
    <StrictMode>
      <SettingsApp client={client} />
    </StrictMode>,
  );
}
