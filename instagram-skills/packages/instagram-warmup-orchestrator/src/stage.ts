import type { InstagramWarmupStage } from "./schema.js";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 输入：明确日期字符串。
 * 输出：UTC 零点日期对象。
 * 作用：校验并解析 YYYY-MM-DD 日期，避免读取系统当前时间。
 */
export function parseDateOnly(value: string, fieldName: string): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return date;
}

/**
 * 输入：注册日期和当前日期。
 * 输出：自然日差值，注册当天为第 1 天。
 * 作用：为养号阶段判断提供稳定的日期序号。
 */
export function warmupDayNumber(registeredAt: string, currentDate: string): number {
  const registeredDate = parseDateOnly(registeredAt, "registeredAt");
  const current = parseDateOnly(currentDate, "currentDate");
  const diffMs = current.getTime() - registeredDate.getTime();
  if (diffMs < 0) {
    throw new Error("currentDate must not be earlier than registeredAt");
  }
  return Math.floor(diffMs / ONE_DAY_MS) + 1;
}

/**
 * 输入：注册日期和当前日期。
 * 输出：养号阶段。
 * 作用：按第一版写死规则判断 day_1_5、day_6_14 或 stable。
 */
export function resolveWarmupStage(registeredAt: string, currentDate: string): InstagramWarmupStage {
  const dayNumber = warmupDayNumber(registeredAt, currentDate);
  if (dayNumber <= 5) return "day_1_5";
  if (dayNumber <= 14) return "day_6_14";
  return "stable";
}

/**
 * 输入：当前日期。
 * 输出：下一次建议执行时间 ISO 字符串。
 * 作用：返回次日固定小时的建议运行时间，不启动任何定时任务。
 */
export function nextSuggestedRunAt(currentDate: string, hour = 9): string {
  const current = parseDateOnly(currentDate, "currentDate");
  current.setUTCDate(current.getUTCDate() + 1);
  current.setUTCHours(hour, 0, 0, 0);
  return current.toISOString();
}
