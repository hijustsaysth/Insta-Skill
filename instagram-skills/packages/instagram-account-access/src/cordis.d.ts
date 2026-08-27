declare module "@deepseek-ai/cordis" {
  export interface Context {
    provide(name: string, value?: unknown): () => void;
  }
}
