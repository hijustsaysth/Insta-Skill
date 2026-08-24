export interface AiograpiRestClientConfig {
  baseUrl: string;
  requestTimeoutMs: number;
  fetch?: AiograpiRestFetch;
  defaultSessionHeaderName?: string;
}

export interface AiograpiRestResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
}

export type AiograpiRestFetch = (url: string, init: AiograpiRestRequestInit) => Promise<AiograpiRestResponse>;

export interface AiograpiRestRequestInit {
  method: string;
  headers: Record<string, string>;
  body?: BodyInit;
  signal?: AbortSignal;
}

export const DEFAULT_SESSION_HEADER_NAME = "X-Session-ID";
