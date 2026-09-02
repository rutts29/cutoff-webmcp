import type {
  OrderPlan,
  ReasonCode,
  StockItem,
} from "../domain/types";

const ORDER_SHEET_COLUMNS = [
  "sku",
  "item",
  "unit",
  "caseSize",
  "cases",
  "lineCost",
  "reason",
] as const;

type OrderSheetExportInput = Readonly<{
  items: readonly StockItem[];
  workingPlan: OrderPlan;
  reasons: Readonly<Record<string, ReasonCode>>;
}>;

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: readonly (string | number)[]): string {
  return values.map(escapeCsvValue).join(",");
}

export function buildOrderSheetCsv({
  items,
  workingPlan,
  reasons,
}: OrderSheetExportInput): string {
  const linesBySku = new Map(
    workingPlan.lines.map((line) => [line.skuId, line]),
  );

  const itemRows = items.map((item) => {
    const line = linesBySku.get(item.id);
    if (line === undefined) {
      throw new Error(`Working order is missing stock line ${item.id}.`);
    }

    const reason = reasons[item.id];
    if (reason === undefined) {
      throw new Error(`Working order is missing reason for ${item.id}.`);
    }

    return csvRow([
      item.id,
      item.name,
      item.unit,
      item.caseSize,
      line.cases,
      line.lineCost,
      reason,
    ]);
  });

  const totalCases = workingPlan.lines.reduce(
    (total, line) => total + line.cases,
    0,
  );

  return [
    csvRow(ORDER_SHEET_COLUMNS),
    ...itemRows,
    csvRow(["TOTAL", "", "", "", totalCases, workingPlan.totalCost, ""]),
  ].join("\r\n");
}

export function getOrderSheetCsvFilename(serviceDate: string): string {
  return `cutoff-order-${serviceDate}.csv`;
}
