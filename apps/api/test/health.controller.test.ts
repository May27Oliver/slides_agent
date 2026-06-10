import { describe, expect, it } from "vitest";
import { HealthController } from "@/modules/health/health.controller";

/**
 * Pure controller unit test for the liveness endpoint (012). We instantiate the
 * controller and call its method directly — no HTTP, no route-string assertion.
 * The real path `/api/health` (via setGlobalPrefix("api")) and the absence of a
 * guard are confirmed by the deployment smoke (`curl /api/health`), not here.
 */
describe("HealthController", () => {
  it("returns a liveness payload without touching DB/Redis", () => {
    const controller = new HealthController();
    expect(controller.check()).toEqual({ status: "ok" });
  });
});
