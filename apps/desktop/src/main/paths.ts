import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { app } from 'electron';

const dataDirectoryEnvVar = 'TOPH_DATA_DIRECTORY';

export interface TophDataPaths {
  dataDirectory: string;
  authPath: string;
  settingsPath: string;
  databasePath: string;
  recordingsDirectory: string;
}

export async function resolveTophDataPaths(electronApp: Pick<typeof app, 'getPath'>) {
  const configuredDirectory = process.env[dataDirectoryEnvVar];
  const dataDirectory = configuredDirectory
    ? resolve(configuredDirectory)
    : electronApp.getPath('userData');

  const paths: TophDataPaths = {
    dataDirectory,
    authPath: join(dataDirectory, 'auth.json'),
    settingsPath: join(dataDirectory, 'settings.json'),
    databasePath: join(dataDirectory, 'data.db'),
    recordingsDirectory: join(dataDirectory, 'recordings'),
  };

  await mkdir(paths.dataDirectory, { recursive: true });
  await mkdir(paths.recordingsDirectory, { recursive: true });

  return paths;
}
