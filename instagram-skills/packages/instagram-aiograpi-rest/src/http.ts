import { InstagramProviderError } from "./instagram-types.js";
import { DEFAULT_SESSION_HEADER_NAME, type AiograpiRestClientConfig, type AiograpiRestFetch } from "./config.js";

export interface AiograpiRestHttpClient {
  requestJson<T>(request: AiograpiRestJsonRequest): Promise<T>;
  requestForm<T>(request: AiograpiRestFormRequest): Promise<T>;
  requestMultipart<T>(request: AiograpiRestMultipartRequest): Promise<T>;
}

interface AiograpiRestBaseRequest {
  path: string;
  method: "GET" | "POST" | "PATCH";
  sessionRef?: string;
  query?: Record<string, string | number | undefined>;
}

export interface AiograpiRestJsonRequest extends AiograpiRestBaseRequest {
  body?: unknown;
}

export interface AiograpiRestFormRequest extends AiograpiRestBaseRequest {
  body: URLSearchParams;
}

export interface AiograpiRestMultipartRequest extends AiograpiRestBaseRequest {
  body: FormData;
}

interface JsonHttpErrorBody {
  error?: string;
  message?: string;
}

/**
 * 输入：aiograpi-rest client 配置。
 * 输出：HTTP client。
 * 作用：创建负责 URL 拼接、session header、JSON 编解码和错误映射的 HTTP 层。
 */
export function createAiograpiRestHttpClient(config: AiograpiRestClientConfig): AiograpiRestHttpClient {
  if (config.baseUrl.trim().length === 0) {
    throw new Error("AIOGRAPI_REST_BASE_URL_REQUIRED");
  }

  if (!Number.isFinite(config.requestTimeoutMs) || config.requestTimeoutMs <= 0) {
    throw new Error("AIOGRAPI_REST_REQUEST_TIMEOUT_MS_INVALID");
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const sessionHeaderName = config.defaultSessionHeaderName ?? DEFAULT_SESSION_HEADER_NAME;
  const fetchImpl = config.fetch ?? getGlobalFetch();

  return {
    async requestJson<T>(request: AiograpiRestJsonRequest) {
      return requestBody<T>({
        baseUrl,
        fetchImpl,
        sessionHeaderName,
        requestTimeoutMs: config.requestTimeoutMs,
        request,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        contentType: "application/json"
      });
    },
    async requestForm<T>(request: AiograpiRestFormRequest) {
      return requestBody<T>({
        baseUrl,
        fetchImpl,
        sessionHeaderName,
        requestTimeoutMs: config.requestTimeoutMs,
        request,
        body: request.body,
        contentType: "application/x-www-form-urlencoded"
      });
    },
    async requestMultipart<T>(request: AiograpiRestMultipartRequest) {
      return requestBody<T>({
        baseUrl,
        fetchImpl,
        sessionHeaderName,
        requestTimeoutMs: config.requestTimeoutMs,
        request,
        body: request.body
      });
    }
  };
}

interface AiograpiRestBodyRequest<TRequest extends AiograpiRestBaseRequest> {
  baseUrl: string;
  fetchImpl: AiograpiRestFetch;
  sessionHeaderName: string;
  requestTimeoutMs: number;
  request: TRequest;
  body?: BodyInit | undefined;
  contentType?: string;
}

/**
 * 输入：HTTP 请求上下文、请求体和可选 content-type。
 * 输出：解析后的 provider JSON 响应。
 * 作用：统一执行 aiograpi-rest 请求、超时控制、响应解析和错误映射。
 */
async function requestBody<T>(options: AiograpiRestBodyRequest<AiograpiRestBaseRequest>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const url = buildUrl(options.baseUrl, options.request.path, options.request.query);
    const response = await options.fetchImpl(url, {
      method: options.request.method,
      headers: createHeaders(options.sessionHeaderName, options.request.sessionRef, options.contentType),
      ...(options.body === undefined ? {} : { body: options.body }),
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
        `aiograpi-rest request timed out after ${options.requestTimeoutMs}ms`,
        error
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 输入：baseUrl、接口 path 和可选 query。
 * 输出：完整请求 URL。
 * 作用：统一生成 aiograpi-rest 请求地址。
 */
function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * 输入：session header 名称和 sessionRef。
 * 输出：HTTP headers。
 * 作用：为请求附带内容类型，并在需要时附带 aiograpi-rest session 标识。
 */
function createHeaders(sessionHeaderName: string, sessionRef: string | undefined, contentType?: string): Record<string, string> {
  return {
    ...(contentType === undefined ? {} : { "content-type": contentType }),
    ...(sessionRef === undefined ? {} : { [sessionHeaderName]: sessionRef })
  };
}

/**
 * 输入：HTTP response。
 * 输出：JSON 对象。
 * 作用：读取 provider 响应体，空响应返回空对象，非法 JSON 快速失败。
 */
async function readJsonBody(response: { text(): Promise<string> }): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new InstagramProviderError("provider_request_failed", "aiograpi-rest returned invalid JSON", error);
  }
}

/**
 * 输入：HTTP 状态码、状态文本和 provider 响应体。
 * 输出：InstagramProviderError。
 * 作用：把 aiograpi-rest HTTP 失败映射成核心 provider 错误。
 */
function mapHttpError(status: number, statusText: string | undefined, body: unknown): InstagramProviderError {
  const message = readErrorMessage(status, statusText, body);

  if (status === 401 || status === 403) {
    return new InstagramProviderError("auth_required", message, body);
  }

  if (status === 429) {
    return new InstagramProviderError("rate_limited", message, body);
  }

  if (status === 400 || status === 422 || status === 501) {
    return new InstagramProviderError("unsupported_operation", message, body);
  }

  return new InstagramProviderError("provider_request_failed", message, body);
}

/**
 * 输入：HTTP 状态码、状态文本和响应体。
 * 输出：错误消息。
 * 作用：优先使用 provider 返回的错误文本，缺失时生成稳定错误消息。
 */
function readErrorMessage(status: number, statusText: string | undefined, body: unknown): string {
  if (isJsonHttpErrorBody(body)) {
    return body.message ?? body.error ?? `aiograpi-rest request failed: ${status}`;
  }

  return statusText ? `aiograpi-rest request failed: ${status} ${statusText}` : `aiograpi-rest request failed: ${status}`;
}

/**
 * 输入：未知响应体。
 * 输出：是否包含错误文本。
 * 作用：把 JSON 响应体收窄为错误响应结构。
 */
function isJsonHttpErrorBody(body: unknown): body is JsonHttpErrorBody {
  return typeof body === "object" && body !== null;
}

/**
 * 输入：未知错误。
 * 输出：是否为 AbortController 超时/取消错误。
 * 作用：把请求超时稳定映射为 provider_request_failed。
 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * 输入：无。
 * 输出：当前运行时全局 fetch。
 * 作用：在未注入 fetch 时使用 Node/运行时自带 fetch，缺失则快速失败。
 */
function getGlobalFetch(): AiograpiRestFetch {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("AIOGRAPI_REST_FETCH_REQUIRED");
  }

  return async (url, init) => globalThis.fetch(url, init);
}
