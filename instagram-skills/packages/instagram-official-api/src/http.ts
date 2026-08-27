import { InstagramProviderError } from "@instagram-skills/instagram-core";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_ZERNIO_BASE_URL,
  type InstagramOfficialApiConfig,
  type ZernioFetch
} from "./config.js";

export interface ZernioHttpClient {
  requestJson<T>(request: ZernioJsonRequest): Promise<T>;
}

interface ZernioJsonRequest {
  path: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, boolean | number | string | undefined>;
  body?: unknown;
  idempotencyKey?: string | undefined;
  requestId?: string | undefined;
}

interface JsonHttpErrorBody {
  code?: string;
  error?: string;
  message?: string;
}

/**
 * 输入：Zernio API 配置。
 * 输出：HTTP client。
 * 作用：统一处理 Zernio URL、鉴权、JSON、超时和错误映射。
 */
export function createZernioHttpClient(config: InstagramOfficialApiConfig): ZernioHttpClient {
  if (config.apiKey.trim().length === 0) {
    throw new Error("ZERNIO_API_KEY_REQUIRED");
  }

  const requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error("ZERNIO_REQUEST_TIMEOUT_MS_INVALID");
  }

  const baseUrl = (config.zernioBaseUrl ?? DEFAULT_ZERNIO_BASE_URL).replace(/\/+$/, "");
  if (baseUrl.trim().length === 0) {
    throw new Error("ZERNIO_BASE_URL_REQUIRED");
  }

  const fetchImpl = config.fetch ?? getGlobalFetch();

  return {
    async requestJson<T>(request: ZernioJsonRequest) {
      return requestJson<T>({
        apiKey: config.apiKey,
        baseUrl,
        fetchImpl,
        request,
        requestTimeoutMs
      });
    }
  };
}

interface RequestJsonOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl: ZernioFetch;
  request: ZernioJsonRequest;
  requestTimeoutMs: number;
}

async function requestJson<T>(options: RequestJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await options.fetchImpl(buildUrl(options.baseUrl, options.request.path, options.request.query), {
      method: options.request.method,
      headers: createHeaders(
        options.apiKey,
        options.request.body !== undefined,
        options.request.idempotencyKey,
        options.request.requestId
      ),
      ...(options.request.body === undefined ? {} : { body: JSON.stringify(options.request.body) }),
      signal: controller.signal
    });
    const body = await readJsonBody(response);

    if (!response.ok) {
      throw mapHttpError(response.status, response.statusText, body);
    }

    return body as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new InstagramProviderError(
        "provider_request_failed",
        `Zernio request timed out after ${options.requestTimeoutMs}ms`,
        error
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, boolean | number | string | undefined>): string {
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function createHeaders(
  apiKey: string,
  hasBody: boolean,
  idempotencyKey?: string,
  requestId?: string
): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    ...(hasBody ? { "content-type": "application/json" } : {}),
    ...(idempotencyKey === undefined ? {} : { "idempotency-key": idempotencyKey }),
    ...(requestId === undefined ? {} : { "x-request-id": requestId })
  };
}

async function readJsonBody(response: { text(): Promise<string> }): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new InstagramProviderError("provider_request_failed", "Zernio returned invalid JSON", error);
  }
}

function mapHttpError(status: number, statusText: string | undefined, body: unknown): InstagramProviderError {
  const message = readErrorMessage(status, statusText, body);

  if (status === 401 || status === 403) {
    return new InstagramProviderError("auth_required", message, body);
  }

  if (status === 429) {
    return new InstagramProviderError("rate_limited", message, body);
  }

  if (status === 400 || status === 402 || status === 404 || status === 422) {
    return new InstagramProviderError("unsupported_operation", message, body);
  }

  return new InstagramProviderError("provider_request_failed", message, body);
}

function readErrorMessage(status: number, statusText: string | undefined, body: unknown): string {
  if (isJsonHttpErrorBody(body)) {
    return body.message ?? body.error ?? body.code ?? `Zernio request failed: ${status}`;
  }

  return statusText ? `Zernio request failed: ${status} ${statusText}` : `Zernio request failed: ${status}`;
}

function isJsonHttpErrorBody(body: unknown): body is JsonHttpErrorBody {
  return typeof body === "object" && body !== null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getGlobalFetch(): ZernioFetch {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("ZERNIO_FETCH_REQUIRED");
  }

  return async (url, init) => globalThis.fetch(url, init);
}
