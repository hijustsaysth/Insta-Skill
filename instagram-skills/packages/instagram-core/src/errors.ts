export type InstagramProviderErrorCode =
  | "auth_required"
  | "rate_limited"
  | "unsupported_operation"
  | "provider_request_failed"
  | "NOT_IMPLEMENTED"
  | "SESSION_REF_NOT_FOUND"
  | "SESSION_NOT_ACTIVE"
  | "SESSION_DETAIL_NOT_FOUND"
  | "provider_validation_failed";

export class InstagramProviderError extends Error {
  readonly code: InstagramProviderErrorCode;
  readonly causeDetail?: unknown;

  /**
   * 输入：错误码、错误信息和可选原始错误。
   * 输出：InstagramProviderError 实例。
   * 作用：统一 provider/client 层向外抛出的错误结构。
   */
  constructor(code: InstagramProviderErrorCode, message: string, causeDetail?: unknown) {
    super(message);
    this.name = "InstagramProviderError";
    this.code = code;
    this.causeDetail = causeDetail;
  }
}

/**
 * 输入：未实现能力名称。
 * 输出：InstagramProviderError。
 * 作用：为架构骨架中的未实现能力提供明确占位错误。
 */
export function notImplemented(feature: string): InstagramProviderError {
  return new InstagramProviderError("NOT_IMPLEMENTED", `${feature} is not implemented`);
}
