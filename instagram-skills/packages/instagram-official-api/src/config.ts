export interface InstagramOfficialApiConfig {
  zernioBaseUrl?: string;
  apiKey: string;
  requestTimeoutMs?: number;
  fetch?: ZernioFetch;
}

export interface ZernioResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
}

export type ZernioFetch = (url: string, init: ZernioRequestInit) => Promise<ZernioResponse>;

export interface ZernioRequestInit {
  method: string;
  headers: Record<string, string>;
  body?: BodyInit;
  signal?: AbortSignal;
}

export const DEFAULT_ZERNIO_BASE_URL = "https://zernio.com/api/v1";
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
