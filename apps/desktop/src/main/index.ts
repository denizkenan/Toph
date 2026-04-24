import { app } from 'electron';

import { bootstrap } from './bootstrap';

const toggleCaptureFlag = '--toggle-capture';
const shouldToggleOnLaunch = process.argv.includes(toggleCaptureFlag);

if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');
}

void bootstrap({
  shouldToggleOnLaunch,
  toggleCaptureFlag,
}).catch((error) => {
  console.error('Toph failed to bootstrap.', error);
  app.quit();
});
