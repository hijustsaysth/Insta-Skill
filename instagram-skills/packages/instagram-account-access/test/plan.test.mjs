import assert from "node:assert/strict";
import test from "node:test";
import { createAccountAccessPlan } from "../dist/index.js";

test("password login plan points agent to account access service", () => {
  const plan = createAccountAccessPlan({
    planId: "plan_001",
    action: "aiograpi_login_with_password"
  });

  assert.equal(plan.planId, "plan_001");
  assert.equal(plan.providerId, "aiograpi-rest");
  assert.equal(plan.nextServiceCall, "loginWithPassword");
  assert.deepEqual(plan.requiredInputs, ["accountId", "username", "password"]);
  assert.deepEqual(plan.sensitiveInputs, ["password", "verificationCode"]);
});

test("official binding plan returns auth-url execution route", () => {
  const plan = createAccountAccessPlan({
    planId: "plan_002",
    action: "official_start_binding"
  });

  assert.equal(plan.providerId, "official-api");
  assert.equal(plan.nextServiceCall, "startOfficialBinding");
  assert.deepEqual(plan.requiredInputs, ["profileName"]);
  assert.equal(plan.sessionStoreActions.length, 0);
});
