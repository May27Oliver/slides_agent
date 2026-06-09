import { describe, expect, it } from "vitest";
import type { BrowsableTheme, ThemeStore } from "@slides-agent/domain";
import { composeKit } from "@slides-agent/domain";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import { ThemesController } from "@/modules/themes/themes.controller";

const theme = (over: Partial<BrowsableTheme> & Pick<BrowsableTheme, "id" | "kind">): BrowsableTheme => ({
  name: over.id,
  keywords: [],
  support: "full",
  styleKit: {},
  ...over
});

function makeStore(browsable: BrowsableTheme[]): ThemeStore {
  return {
    listSelectable: async () => [],
    listBrowsable: async () => browsable
  };
}

describe("ThemesController GET /api/themes", () => {
  it("is protected by JwtAuthGuard", () => {
    const guards = Reflect.getMetadata("__guards__", ThemesController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });

  it("groups the catalogue by axis, preserving store order within each axis", async () => {
    const controller = new ThemesController(
      makeStore([
        theme({ id: "font-00", kind: "font" }),
        theme({ id: "palette-00", kind: "palette" }),
        theme({ id: "palette-10", kind: "palette" }),
        theme({ id: "style-00", kind: "style" })
      ])
    );

    const result = await controller.list();

    expect(result.font.map((t) => t.id)).toEqual(["font-00"]);
    expect(result.palette.map((t) => t.id)).toEqual(["palette-00", "palette-10"]);
    expect(result.style.map((t) => t.id)).toEqual(["style-00"]);
  });

  it("returns the trusted-builtin partial styleKit verbatim (no endpoint re-sanitize, no shim)", async () => {
    // F6: a font family carrying CSS-special characters is passed through unchanged —
    // the endpoint does not sanitize; the renderer escapes at the use boundary.
    const hostileFontKit = { fonts: { heading: '"</style><script>", sans', body: "Inter" } };
    const controller = new ThemesController(
      makeStore([theme({ id: "font-00", kind: "font", styleKit: hostileFontKit })])
    );

    const { font } = await controller.list();
    expect(font[0]?.styleKit).toEqual(hostileFontKit);
    // the partial kit is accepted by composeKit directly — no kit↔swatch shim needed.
    expect(() => composeKit({ font: font[0]?.styleKit as never })).not.toThrow();
  });
});
