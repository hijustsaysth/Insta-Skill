import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createProfileSetupToolRegistry,
  instagramProfileEditPlan,
  instagramProfileGenerate,
  profileSetupTools
} from "../dist/index.js";
import { apply } from "../dist/plugin.js";

test("generates username displayName biography and avatar from prompts and reference assets", async () => {
  const result = await instagramProfileGenerate({
    accountId: "acct_001",
    targets: ["username", "displayName", "biography", "avatar"],
    namePrompt: "Youweinuo Machinery Parts",
    brandPrefix: "YOUWEINUO",
    englishName: "Jack",
    businessPrompt: "Kubota/Yanmar/World/Lovol harvester spare parts",
    contactPrompt: "+12345678900",
    referenceAssets: ["F:/assets/avatar.jpg"],
    generatedAvatarAssets: ["F:/output/avatar-1.png", "F:/output/avatar-2.png", "F:/output/avatar-3.png"],
    targetLanguage: "en"
  });

  assert.deepEqual(result, {
    username: "youweinuo_machinery_parts",
    displayName: "YOUWEINUO-Jack",
    biography: "Selling Kubota/Yanmar/World/Lovol harvester spare parts. Contact & WhatsAPP: +12345678900",
    avatarAsset: {
      uri: "F:/output/avatar-1.png",
      mediaType: "image"
    },
    avatarGeneration: {
      status: "generated",
      requestedCount: 3,
      referenceAssets: [
        {
          uri: "F:/assets/avatar.jpg",
          mediaType: "image"
        }
      ],
      generatedAssets: [
        {
          uri: "F:/output/avatar-1.png",
          mediaType: "image"
        },
        {
          uri: "F:/output/avatar-2.png",
          mediaType: "image"
        },
        {
          uri: "F:/output/avatar-3.png",
          mediaType: "image"
        }
      ],
      prompt: "Generate 3 square Instagram avatar images for YOUWEINUO-Jack. Match the visual style and business category of these reference assets: F:/assets/avatar.jpg. Business context: Kubota/Yanmar/World/Lovol harvester spare parts. Use a clean brand/profile composition suitable for a small circular crop; avoid extra text, watermarks, and clutter. Save generated assets under output and return their file paths."
    }
  });
});

test("supports generating only biography without name prompt", async () => {
  const result = await instagramProfileGenerate({
    accountId: "acct_001",
    targets: ["biography"],
    businessPrompt: "Kubota harvester spare parts",
    contactPrompt: "+12345678900"
  });

  assert.deepEqual(result, { biography: "Selling Kubota harvester spare parts. Contact & WhatsAPP: +12345678900" });
});

test("reports avatar generation degradation without generated image paths", async () => {
  const result = await instagramProfileGenerate({
    accountId: "acct_001",
    targets: ["avatar"],
    referenceAssets: ["https://cdn.example/avatar.png"],
    avatarGenerationSupported: false
  });

  assert.deepEqual(result, {
    avatarGeneration: {
      status: "degraded",
      requestedCount: 3,
      referenceAssets: [
        {
          uri: "https://cdn.example/avatar.png",
          mediaType: "image"
        }
      ],
      generatedAssets: [],
      prompt: "Generate 3 square Instagram avatar images for the Instagram profile. Match the visual style and business category of these reference assets: https://cdn.example/avatar.png. Business context: business shown in the reference assets. Use a clean brand/profile composition suitable for a small circular crop; avoid extra text, watermarks, and clutter. Save generated assets under output and return their file paths.",
      fallbackReason: "agent image generation is not supported"
    }
  });
});

test("rejects missing required generation inputs", async () => {
  await assert.rejects(
    () => instagramProfileGenerate({ accountId: "acct_001", targets: ["biography"] }),
    /PROFILE_BUSINESSPROMPT_REQUIRED/
  );
  await assert.rejects(
    () => instagramProfileGenerate({ accountId: "acct_001", targets: ["displayName"], brandPrefix: "Brand" }),
    /PROFILE_ENGLISHNAME_REQUIRED/
  );
  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["biography"],
        businessPrompt: "Kubota harvester spare parts"
      }),
    /PROFILE_CONTACTPROMPT_REQUIRED/
  );
  await assert.rejects(
    () => instagramProfileGenerate({ accountId: "acct_001", targets: ["avatar"] }),
    /PROFILE_AVATAR_REFERENCE_ASSET_REQUIRED/
  );
});

test("rejects generated fields over built-in limits", async () => {
  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["displayName"],
        brandPrefix: "x".repeat(60),
        englishName: "tool"
      }),
    /PROFILE_FIELD_TOO_LONG: max 64/
  );
  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["biography"],
        businessPrompt: "x".repeat(151),
        contactPrompt: "+12345678900"
      }),
    /PROFILE_FIELD_TOO_LONG: max 150/
  );
});

test("rejects generated avatar asset counts outside two to three", async () => {
  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["avatar"],
        referenceAssets: ["F:/assets/avatar.jpg"],
        generatedAvatarAssets: ["F:/output/avatar-1.png"]
      }),
    /PROFILE_GENERATED_AVATAR_ASSETS_UNSUPPORTED/
  );
  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["avatar"],
        referenceAssets: ["F:/assets/avatar.jpg"],
        avatarCount: 4
      }),
    /PROFILE_AVATAR_COUNT_UNSUPPORTED/
  );
});

test("rejects generated avatar asset count that does not match avatarCount", async () => {
  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["avatar"],
        referenceAssets: ["F:/assets/avatar.jpg"],
        generatedAvatarAssets: ["F:/output/avatar-1.png", "F:/output/avatar-2.png"]
      }),
    /PROFILE_GENERATED_AVATAR_ASSETS_COUNT_MISMATCH/
  );

  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["avatar"],
        referenceAssets: ["F:/assets/avatar.jpg"]
      }),
    /PROFILE_GENERATED_AVATAR_ASSETS_REQUIRED/
  );
});

test("rejects username candidates over Instagram limit", async () => {
  await assert.rejects(
    () =>
      instagramProfileGenerate({
        accountId: "acct_001",
        targets: ["username"],
        namePrompt: "a".repeat(31)
      }),
    /PROFILE_USERNAME_TOO_LONG/
  );
});

test("creates approved profile edit plan without executing provider", async () => {
  const result = await instagramProfileEditPlan({
    accountId: "acct_001",
    sessionRef: "session_001",
    approved: true,
    biography: "hello world",
    preferredProvider: "instagram-client"
  });

  assert.deepEqual(result, {
    action: "update_profile",
    approvalRequired: false,
    targetTool: "InstagramClient.profile.updateProfile",
    requestDraft: {
      accountId: "acct_001",
      sessionRef: "session_001",
      biography: "hello world"
    },
    fieldsToUpdate: ["biography"],
    warnings: []
  });
});

test("edit plan supports mcp target and warnings", async () => {
  const result = await instagramProfileEditPlan({
    accountId: "acct_001",
    approved: true,
    username: "new_username",
    preferredProvider: "mcp-tool"
  });

  assert.equal(result.targetTool, "instagram.profile.update");
  assert.deepEqual(result.fieldsToUpdate, ["username"]);
  assert.equal(result.warnings.length, 2);
});

test("edit plan rejects unapproved empty or invalid updates", async () => {
  await assert.rejects(
    () => instagramProfileEditPlan({ accountId: "acct_001", approved: false, biography: "hello" }),
    /PROFILE_EDIT_APPROVAL_REQUIRED/
  );
  await assert.rejects(
    () => instagramProfileEditPlan({ accountId: "acct_001", approved: true }),
    /PROFILE_EDIT_FIELDS_REQUIRED/
  );
  await assert.rejects(
    () => instagramProfileEditPlan({ accountId: "acct_001", approved: true, displayName: "x".repeat(65) }),
    /PROFILE_DISPLAY_NAME_TOO_LONG/
  );
});

test("creates and registers executable tool definitions", async () => {
  const registry = createProfileSetupToolRegistry();

  assert.deepEqual(
    registry.tools.map((tool) => tool.name),
    ["instagram_profile_generate", "instagram_profile_edit_plan"]
  );
  assert.deepEqual(
    profileSetupTools.map((tool) => tool.name),
    ["instagram_profile_generate", "instagram_profile_edit_plan"]
  );

  const generateSchema = registry.schemas().find((tool) => tool.name === "instagram_profile_generate");
  assert.deepEqual(generateSchema.parameters.properties.avatarCount, { type: "integer", enum: [2, 3] });

  const value = await registry.execute("instagram_profile_generate", {
    accountId: "acct_001",
    targets: ["biography"],
    businessPrompt: "Kubota harvester spare parts",
    contactPrompt: "+12345678900"
  });

  assert.deepEqual(value, { biography: "Selling Kubota harvester spare parts. Contact & WhatsAPP: +12345678900" });
});

test("plugin entry registers tools through ctx.tools", () => {
  const registered = [];
  const ctx = {
    tools: {
      register(tool) {
        registered.push(tool.name);
      }
    }
  };

  apply(ctx);

  assert.deepEqual(registered, ["instagram_profile_generate", "instagram_profile_edit_plan"]);
});

test("package source stays provider decoupled", () => {
  const sourceFiles = ["index.ts", "schema.ts", "generate.ts", "edit-plan.ts", "tools.ts", "tool-registry.ts", "plugin.ts", "cli.ts"];
  const forbidden = [
    "instagram-aiograpi-rest",
    "instagram-official-api",
    "instagram-connector",
    "ctx.instagram"
  ];

  for (const file of sourceFiles) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    for (const pattern of forbidden) {
      assert.equal(source.includes(pattern), false, `${file} must not include ${pattern}`);
    }
  }
});
