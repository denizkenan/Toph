import type { SpeechActivityAnalyzer } from './speech-activity-analyzer';

export function createFallbackSpeechActivityAnalyzer(options: {
  primary: SpeechActivityAnalyzer;
  fallback: SpeechActivityAnalyzer;
}): SpeechActivityAnalyzer {
  return {
    name: `${options.primary.name}_with_${options.fallback.name}_fallback`,

    async analyze(input) {
      try {
        console.info(`Toph segmentation trying VAD analyzer: ${options.primary.name}.`);
        const regions = await options.primary.analyze(input);
        console.info(`Toph segmentation completed with VAD analyzer: ${options.primary.name}.`);
        return regions;
      } catch (error) {
        console.error(
          `Toph segmentation VAD analyzer ${options.primary.name} failed; falling back to ${options.fallback.name}.`,
          error,
        );
        const regions = await options.fallback.analyze(input);
        console.info(`Toph segmentation completed with VAD analyzer: ${options.fallback.name}.`);
        return regions;
      }
    },
  };
}
