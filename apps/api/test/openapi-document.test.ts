import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "@/openapi/openapi-document";

describe("buildOpenApiDocument", () => {
  const doc = buildOpenApiDocument();

  it("is a valid OpenAPI 3 document with the preview, decks, and auth/admin routes", () => {
    expect(doc.openapi).toBe("3.0.0");
    expect(Object.keys(doc.paths)).toEqual([
      "/api/themes",
      "/api/decks",
      "/api/decks/{id}",
      "/api/decks/{id}/revisions",
      "/api/decks/{id}/pptx-exports",
      "/api/decks/{id}/pptx-exports/{jobId}",
      "/api/decks/{id}/pptx-exports/{jobId}/file",
      "/api/slides/preview",
      "/api/slides/preview-jobs",
      "/api/slides/preview-jobs/{jobId}",
      "/api/auth/register",
      "/api/auth/config",
      "/api/admin/users",
      "/api/admin/users/{id}"
    ]);
  });

  it("documents the 013 register + admin endpoints with their response codes", () => {
    const register = doc.paths["/api/auth/register"]!.post!;
    expect(Object.keys(register.responses).sort()).toEqual([
      "201",
      "400",
      "403",
      "409",
      "429",
      "500"
    ]);

    const patch = doc.paths["/api/admin/users/{id}"]!.patch!;
    expect(Object.keys(patch.responses).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]);
    const del = doc.paths["/api/admin/users/{id}"]!.delete!;
    expect(Object.keys(del.responses).sort()).toEqual(["204", "401", "403", "404", "409", "500"]);

    const list = doc.paths["/api/admin/users"]!.get!;
    expect(Object.keys(list.responses).sort()).toEqual(["200", "401", "403", "500"]);
  });

  it("documents the 011 GET /api/themes browse endpoint (200/401)", () => {
    const get = doc.paths["/api/themes"]!.get!;
    const responseSchema = (
      get.responses["200"] as { content: Record<string, { schema: { properties: object } }> }
    ).content["application/json"]!.schema;
    expect(Object.keys(responseSchema.properties)).toEqual(["font", "palette", "style"]);
    expect(Object.keys(get.responses).sort()).toEqual(["200", "401", "500"]);
  });

  it("documents the 010 edit-revision endpoint (request body + 201/400/404/409)", () => {
    const post = doc.paths["/api/decks/{id}/revisions"]!.post!;
    const requestSchema = (
      post.requestBody as { content: Record<string, { schema: { properties: object } }> }
    ).content["application/json"]!.schema;
    // 011 added the optional themeSelection override; 014 the chart operations.
    expect(Object.keys(requestSchema.properties)).toEqual([
      "baseRevision",
      "slideDeck",
      "themeSelection",
      "chartOperations"
    ]);
    expect(Object.keys(post.responses).sort()).toEqual(["201", "400", "401", "404", "409", "500"]);
  });

  it("documents 014 chartOperations as the full discriminated public contract", () => {
    const post = doc.paths["/api/decks/{id}/revisions"]!.post!;
    const requestSchema = (
      post.requestBody as {
        content: Record<string, { schema: { properties: Record<string, unknown> } }>;
      }
    ).content["application/json"]!.schema;
    const chartOperations = requestSchema.properties.chartOperations as {
      maxItems: number;
      items: {
        oneOf: Array<{ additionalProperties?: boolean; properties: Record<string, unknown> }>;
      };
    };

    expect(chartOperations.maxItems).toBe(50);
    expect(chartOperations.items.oneOf).toHaveLength(4);
    expect(
      chartOperations.items.oneOf.every((schema) => schema.additionalProperties === false)
    ).toBe(true);
    const addChart = chartOperations.items.oneOf.find((schema) => "source" in schema.properties);
    expect(addChart).toBeDefined();
    const source = addChart!.properties.source as {
      oneOf: Array<{ properties: Record<string, unknown> }>;
    };
    const userData = source.oneOf.find((schema) => "points" in schema.properties);
    expect(userData).toBeDefined();
    const points = userData!.properties.points as {
      maxItems: number;
      items: { properties: Record<string, unknown> };
    };
    expect(points.maxItems).toBe(12);
    expect(points.items.properties.valueText).toMatchObject({
      maxLength: 32,
      pattern: "^-?\\d+(\\.\\d+)?$"
    });
  });

  it("documents the decks read endpoints with ownership-aware response codes", () => {
    const list = doc.paths["/api/decks"]!.get!;
    expect(Object.keys(list.responses).sort()).toEqual(["200", "401", "500"]);
    const detail = doc.paths["/api/decks/{id}"]!.get!;
    expect(Object.keys(detail.responses).sort()).toEqual(["200", "400", "401", "404", "500"]);
  });

  it("documents the create-job request body and response codes from the contract", () => {
    const post = doc.paths["/api/slides/preview-jobs"]!.post!;
    const requestSchema = (
      post.requestBody as { content: Record<string, { schema: { properties: object } }> }
    ).content["application/json"]!.schema;
    expect(Object.keys(requestSchema.properties)).toEqual([
      "sourceContent",
      "deckBrief",
      "themeSelection"
    ]);
    expect(Object.keys(post.responses).sort()).toEqual(["202", "400", "429", "500", "503"]);
  });

  it("documents jobId status responses including the 400 invalid-id and 404", () => {
    const get = doc.paths["/api/slides/preview-jobs/{jobId}"]!.get!;
    expect(Object.keys(get.responses).sort()).toEqual(["200", "400", "404", "500", "503"]);
  });
});
