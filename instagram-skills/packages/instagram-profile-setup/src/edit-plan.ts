import {
  BIOGRAPHY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  type InstagramProfileEditPlanRequest,
  type InstagramProfileEditPlanResult,
  type InstagramProfileEditableField
} from "./schema.js";

/**
 * 输入：人工或上层审批后的资料字段。
 * 输出：资料编辑计划和参数草案。
 * 作用：只生成执行层可用的参数，不调用 provider 或 MCP tool。
 */
export async function instagramProfileEditPlan(
  request: InstagramProfileEditPlanRequest
): Promise<InstagramProfileEditPlanResult> {
  validateEditPlanRequest(request);

  const fieldsToUpdate = readFieldsToUpdate(request);
  const requestDraft = {
    accountId: request.accountId,
    ...(request.sessionRef === undefined ? {} : { sessionRef: request.sessionRef }),
    ...(request.username === undefined ? {} : { username: request.username }),
    ...(request.displayName === undefined ? {} : { displayName: request.displayName }),
    ...(request.biography === undefined ? {} : { biography: request.biography }),
    ...(request.avatarAsset === undefined ? {} : { avatarAsset: request.avatarAsset })
  };

  return {
    action: "update_profile",
    approvalRequired: false,
    targetTool: request.preferredProvider === "mcp-tool" ? "instagram.profile.update" : "InstagramClient.profile.updateProfile",
    requestDraft,
    fieldsToUpdate,
    warnings: createWarnings(request)
  };
}

function validateEditPlanRequest(request: InstagramProfileEditPlanRequest): void {
  assertNonEmpty(request.accountId, "accountId");

  if (!request.approved) {
    throw new Error("PROFILE_EDIT_APPROVAL_REQUIRED");
  }

  if (request.displayName !== undefined && request.displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`PROFILE_DISPLAY_NAME_TOO_LONG: max ${DISPLAY_NAME_MAX_LENGTH}`);
  }

  if (request.biography !== undefined && request.biography.length > BIOGRAPHY_MAX_LENGTH) {
    throw new Error(`PROFILE_BIOGRAPHY_TOO_LONG: max ${BIOGRAPHY_MAX_LENGTH}`);
  }

  if (request.avatarAsset !== undefined) {
    assertNonEmpty(request.avatarAsset.uri, "avatarAsset.uri");
    if (request.avatarAsset.mediaType !== "image") {
      throw new Error("PROFILE_AVATAR_ASSET_IMAGE_REQUIRED");
    }
  }

  if (readFieldsToUpdate(request).length === 0) {
    throw new Error("PROFILE_EDIT_FIELDS_REQUIRED");
  }
}

function readFieldsToUpdate(request: InstagramProfileEditPlanRequest): InstagramProfileEditableField[] {
  const fields: InstagramProfileEditableField[] = [];

  if (request.username !== undefined && request.username.trim().length > 0) {
    fields.push("username");
  }

  if (request.displayName !== undefined && request.displayName.trim().length > 0) {
    fields.push("displayName");
  }

  if (request.biography !== undefined && request.biography.trim().length > 0) {
    fields.push("biography");
  }

  if (request.avatarAsset !== undefined) {
    fields.push("avatarAsset");
  }

  return fields;
}

function createWarnings(request: InstagramProfileEditPlanRequest): string[] {
  const warnings: string[] = [];

  if (request.sessionRef === undefined || request.sessionRef.trim().length === 0) {
    warnings.push("sessionRef missing; execution layer must attach an authenticated session before updating profile");
  }

  if (request.username !== undefined) {
    warnings.push("username changes can trigger Instagram review or extra verification");
  }

  return warnings;
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`PROFILE_${field.toUpperCase()}_REQUIRED`);
  }
}
