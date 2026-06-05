import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "@/openapi/openapi-document";

describe("buildOpenApiDocument", () => {
  const doc = buildOpenApiDocument();

  it("is a valid OpenAPI 3 document with the preview and decks routes", () => {
    expect(doc.openapi).toBe("3.0.0");
    expect(Object.keys(doc.paths)).toEqual([
      "/api/decks",
      "/api/decks/{id}",
      "/api/slides/preview",
      "/api/slides/preview-jobs",
      "/api/slides/preview-jobs/{jobId}"
    ]);
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
    expect(Object.keys(requestSchema.properties)).toEqual(["sourceContent", "deckBrief"]);
    expect(Object.keys(post.responses).sort()).toEqual(["202", "400", "429", "500", "503"]);
  });

  it("documents jobId status responses including the 400 invalid-id and 404", () => {
    const get = doc.paths["/api/slides/preview-jobs/{jobId}"]!.get!;
    expect(Object.keys(get.responses).sort()).toEqual(["200", "400", "404", "500", "503"]);
  });
});
