import type { InstagramClient } from "@instagram-skills/instagram-core";
import type { InstagramContext } from "./context.js";

export interface InstagramProviderRegistration {
  id: string;
  client: InstagramClient;
}

export interface InstagramProviderHandle {
  id: string;
  dispose: () => void;
}

/**
 * 输入：Cordis 兼容上下文和 provider 注册信息。
 * 输出：provider 注册句柄。
 * 作用：把 InstagramClient 注册到 ctx.instagram，并保留 provider id 扩展点。
 */
export function provideInstagram(
  ctx: InstagramContext,
  registration: InstagramProviderRegistration
): InstagramProviderHandle {
  const dispose = ctx.provide("instagram", registration.client);

  return {
    id: registration.id,
    dispose
  };
}
