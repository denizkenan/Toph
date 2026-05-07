import type {
  StreamingSpeechActivityAnalyzer,
  StreamingSpeechActivityAnalyzerSession,
} from './streaming-speech-activity-analyzer';

class FallbackStreamingSpeechActivitySession implements StreamingSpeechActivityAnalyzerSession {
  private active: StreamingSpeechActivityAnalyzerSession;
  private fallback: StreamingSpeechActivityAnalyzerSession | null = null;

  constructor(
    private readonly options: {
      primaryName: string;
      fallbackName: string;
      primary: StreamingSpeechActivityAnalyzerSession;
      createFallback: () => Promise<StreamingSpeechActivityAnalyzerSession>;
    },
  ) {
    this.active = options.primary;
  }

  async scoreFrame(frame: Float32Array) {
    try {
      return await this.active.scoreFrame(frame);
    } catch (error) {
      if (this.fallback) {
        throw error;
      }

      console.error(
        `Toph streaming VAD analyzer ${this.options.primaryName} failed while processing; falling back to ${this.options.fallbackName}.`,
        error,
      );
      try {
        await this.active.dispose();
      } catch (disposeError) {
        console.error(`Toph could not dispose failed VAD analyzer ${this.options.primaryName}.`, disposeError);
      }
      this.fallback = await this.options.createFallback();
      this.active = this.fallback;
      return this.active.scoreFrame(frame);
    }
  }

  async flush() {
    await this.active.flush();
  }

  async dispose() {
    await this.active.dispose();
  }
}

export function createFallbackStreamingSpeechActivityAnalyzer(options: {
  primary: StreamingSpeechActivityAnalyzer;
  fallback: StreamingSpeechActivityAnalyzer;
}): StreamingSpeechActivityAnalyzer {
  return {
    name: `${options.primary.name}-with-${options.fallback.name}-fallback`,
    sampleRate: options.primary.sampleRate,
    frameSizeSamples: options.primary.frameSizeSamples,

    async createSession() {
      try {
        return new FallbackStreamingSpeechActivitySession({
          primaryName: options.primary.name,
          fallbackName: options.fallback.name,
          primary: await options.primary.createSession(),
          createFallback: options.fallback.createSession,
        });
      } catch (error) {
        console.error(`Toph could not initialize ${options.primary.name}; falling back to ${options.fallback.name}.`, error);
        return options.fallback.createSession();
      }
    },
  };
}
