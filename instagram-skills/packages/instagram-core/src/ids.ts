export type Branded<T, Brand extends string> = T & { readonly __brand: Brand };

export type InstagramAccountId = Branded<string, "InstagramAccountId">;
export type InstagramMediaId = Branded<string, "InstagramMediaId">;
export type InstagramPublishId = Branded<string, "InstagramPublishId">;
export type InstagramSessionRef = Branded<string, "InstagramSessionRef">;

/**
 * 输入：原始字符串和品牌名称。
 * 输出：带 branded type 的字符串。
 * 作用：在 JSON 边界之后把普通 string 转换为核心层使用的 id，并拒绝空值。
 */
function createBrandedString<T>(value: string, name: string): T {
  if (value.trim().length === 0) {
    throw new TypeError(`${name} cannot be empty`);
  }

  return value as T;
}

/**
 * 输入：Instagram 账号 id 字符串。
 * 输出：InstagramAccountId。
 * 作用：构造账号 id branded type。
 */
export function InstagramAccountId(value: string): InstagramAccountId {
  return createBrandedString<InstagramAccountId>(value, "InstagramAccountId");
}

/**
 * 输入：Instagram 媒体 id 字符串。
 * 输出：InstagramMediaId。
 * 作用：构造媒体 id branded type。
 */
export function InstagramMediaId(value: string): InstagramMediaId {
  return createBrandedString<InstagramMediaId>(value, "InstagramMediaId");
}

/**
 * 输入：Instagram 发布任务 id 字符串。
 * 输出：InstagramPublishId。
 * 作用：构造发布任务 id branded type。
 */
export function InstagramPublishId(value: string): InstagramPublishId {
  return createBrandedString<InstagramPublishId>(value, "InstagramPublishId");
}

/**
 * 输入：sessionRef 字符串。
 * 输出：InstagramSessionRef。
 * 作用：构造 sessionRef branded type。
 */
export function InstagramSessionRef(value: string): InstagramSessionRef {
  return createBrandedString<InstagramSessionRef>(value, "InstagramSessionRef");
}
