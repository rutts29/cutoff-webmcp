import { describe, expect, it } from "vitest";

import { SEED_COVERS, SEED_ITEMS } from "../data/seed";
import type { OrderPlan, ReasonCode, StockItem } from "../domain/types";
import { calculatePlan, REASON_CODES } from "./orderEngine";
import {
  buildOrderSheetCsv,
  getOrderSheetCsvFilename,
} from "./exportEngine";

function unchangedReasons(
  plan: OrderPlan,
): Readonly<Record<string, ReasonCode>> {
  return Object.fromEntries(
    plan.lines.map((line) => [line.skuId, REASON_CODES.UNCHANGED]),
  );
}

describe("order sheet CSV export", () => {
  it("exports the locked Saturday working order in seed order", () => {
    const workingPlan = calculatePlan({
      items: SEED_ITEMS,
      covers: SEED_COVERS,
    });

    const csv = buildOrderSheetCsv({
      items: SEED_ITEMS,
      workingPlan,
      reasons: unchangedReasons(workingPlan),
    });
    const rows = csv.split("\r\n");

    expect(rows[0]).toBe("sku,item,unit,caseSize,cases,lineCost,reason");
    expect(rows.slice(1, -1)).toHaveLength(10);
    expect(rows.slice(1, -1).map((row) => row.split(",")[0])).toStrictEqual(
      SEED_ITEMS.map((item) => item.id),
    );
    expect(rows[1]).toBe("chicken,Chicken thighs,kg,10,19,1292,UNCHANGED");
    expect(rows[10]).toBe("boxes,Fry boxes,ea,500,1,27,UNCHANGED");
    expect(rows.at(-1)).toBe("TOTAL,,,,78,3629,");
  });

  it("quotes commas, quotes, and line breaks using CSV escaping", () => {
    const items: readonly StockItem[] = [
      {
        id: "special",
        name: "Chef's \"choice\", chilled\ncase",
        unit: "ea",
        caseSize: 6,
        usagePerCover: 1,
        onHand: 0,
        inTransit: 0,
        expiring: 0,
        safety: 0,
        perishable: false,
        costPerCase: 12,
      },
    ];
    const workingPlan: OrderPlan = {
      covers: 6,
      laborHours: 1,
      lines: [{ skuId: "special", cases: 1, lineCost: 12 }],
      totalCost: 12,
    };

    expect(
      buildOrderSheetCsv({
        items,
        workingPlan,
        reasons: { special: REASON_CODES.MANUAL_OVERRIDE_KEPT },
      }),
    ).toBe(
      [
        "sku,item,unit,caseSize,cases,lineCost,reason",
        'special,"Chef\'s ""choice"", chilled\ncase",ea,6,1,12,MANUAL_OVERRIDE_KEPT',
        "TOTAL,,,,1,12,",
      ].join("\r\n"),
    );
  });

  it("builds the locked service-date filename", () => {
    expect(getOrderSheetCsvFilename("2026-09-05")).toBe(
      "cutoff-order-2026-09-05.csv",
    );
  });
});
