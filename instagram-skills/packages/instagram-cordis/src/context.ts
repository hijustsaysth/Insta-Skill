import type { InstagramClient } from "@instagram-skills/instagram-core";
import type { Context as CordisContext } from "@deepseek-ai/cordis";

export type InstagramServiceName = "instagram";

declare module "@deepseek-ai/cordis" {
  interface Context {
    instagram: InstagramClient;
    provide(name: InstagramServiceName, value: InstagramClient): () => void;
  }
}

export type InstagramContext = Pick<CordisContext, InstagramServiceName | "provide">;
