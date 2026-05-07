import { readPcm16MonoWav } from '../../audio/wav';

const defaultChunkBytes = 16_000;

export async function streamPcm16MonoWav(options: {
  filePath: string;
  onChunk: (chunk: Buffer) => Promise<void>;
  chunkBytes?: number;
}) {
  const wav = await readPcm16MonoWav(options.filePath);
  const chunkBytes = options.chunkBytes ?? defaultChunkBytes;

  for (let offset = 0; offset < wav.pcm.length; offset += chunkBytes) {
    await options.onChunk(wav.pcm.subarray(offset, offset + chunkBytes));
  }

  return wav;
}
