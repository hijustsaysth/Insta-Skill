import assert from "node:assert/strict";
import test from "node:test";

import { connectorTools, isConnectorSideEffectTool } from "../dist/index.js";

test("connector tool schema matches local runtime operations", () => {
  assert.deepEqual(
    connectorTools.map((tool) => tool.name),
    [
      "instagram.app.open",
      "instagram.debug.snapshot",
      "instagram.debug.ocr",
      "instagram.search.open",
      "instagram.search.input",
      "instagram.search.open_first_reel",
      "instagram.reel.inspect",
      "instagram.reel.collect_signals",
      "instagram.reel.like",
      "instagram.reel.comment",
      "instagram.reel.next",
      "instagram.reels.engage_workflow"
    ]
  );
});

test("state-changing tools are marked as side-effecting tools", () => {
  const sideEffects = connectorTools.filter((tool) => tool.sideEffect).map((tool) => tool.name);

  assert.deepEqual(sideEffects, ["instagram.reel.like", "instagram.reel.comment"]);
  assert.equal(isConnectorSideEffectTool("instagram.reel.like"), true);
  assert.equal(isConnectorSideEffectTool("instagram.reel.comment"), true);
  assert.equal(isConnectorSideEffectTool("instagram.reels.engage_workflow"), false);
  assert.equal(isConnectorSideEffectTool("instagram.debug.snapshot"), false);
  assert.equal(isConnectorSideEffectTool("instagram.reel.collect_signals"), false);
});

test("tool input schemas do not expose sessionRef", () => {
  for (const tool of connectorTools) {
    assert.equal(Object.hasOwn(tool.inputSchema.properties, "sessionRef"), false);
  }
});

test("search and comment tools declare required text inputs", () => {
  const search = connectorTools.find((tool) => tool.name === "instagram.search.input");
  const comment = connectorTools.find((tool) => tool.name === "instagram.reel.comment");
  const workflow = connectorTools.find((tool) => tool.name === "instagram.reels.engage_workflow");

  assert.deepEqual(search.inputSchema.required, ["keyword"]);
  assert.deepEqual(comment.inputSchema.required, ["commentText"]);
  assert.deepEqual(workflow.inputSchema.required, ["keyword", "perVideoWatchMs", "totalWatchMs"]);
  assert.equal(Object.hasOwn(workflow.inputSchema.properties, "like"), false);
  assert.equal(Object.hasOwn(workflow.inputSchema.properties, "commentText"), false);
  assert.equal(Object.hasOwn(workflow.inputSchema.properties, "nextAfterEngagement"), false);
});
