export interface InstagramVideoTextModel {
  generateJson<T>(request: InstagramVideoTextModelRequest): Promise<T>;
}

export interface InstagramVideoTextModelRequest {
  prompt: string;
  schemaName: string;
}

export interface InstagramVideoVisionModel {
  analyzeFrames(request: InstagramVideoVisionModelRequest): Promise<InstagramVideoVisionModelResult>;
}

export interface InstagramVideoVisionModelRequest {
  frameAssets: string[];
  prompt: string;
}

export interface InstagramVideoVisionModelResult {
  visibleText?: string[];
  ocrText?: string[];
  description?: string;
}

export interface InstagramVideoInteractionRuntimeOptions {
  textModel?: InstagramVideoTextModel;
  visionModel?: InstagramVideoVisionModel;
}
