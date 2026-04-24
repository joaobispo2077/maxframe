import { createAnalyzeVideoUrlUseCase } from '../../application/use-cases/AnalyzeVideoUrlUseCase.js';
import { createInMemoryVideoMetadataGateway } from '../../infrastructure/youtube/InMemoryVideoMetadataGateway.js';

const analyzeVideoUrl = createAnalyzeVideoUrlUseCase(
  createInMemoryVideoMetadataGateway(),
);

export async function analyzeVideoHandler(url: string) {
  return analyzeVideoUrl(url);
}

