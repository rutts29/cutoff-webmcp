import { describe, expect, it } from "vitest";

import evalSchema from "../../evals/schema.json";
import toolCatalog from "./toolCatalog.json";

describe("WebMCP eval schema", () => {
  it("matches the tool catalog used by registration", () => {
    const expectedTools = Object.entries(toolCatalog).map(
      ([name, definition]) => ({
        name,
        description: definition.description,
        inputSchema: definition.inputSchema,
      }),
    );

    expect(evalSchema).toStrictEqual({ tools: expectedTools });
    expect(evalSchema.tools).toHaveLength(5);
  });
});
