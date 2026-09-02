import type { EventUplift } from "../domain/types";
import type { LaborShift, OnCallStaff } from "../domain/labor";
import type { WasteReason } from "../domain/stock";

export const PRESET_IDS = ["saturday", "tuesday"] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export type PresetDefinition = Readonly<{
  id: PresetId;
  label: string;
  serviceLabel: string;
  cutoffLabel: string;
  serviceDate: string;
  cutoffAt: string;
  deliveryAt: string;
  baseCovers: number;
  seedCovers: number;
  eventUplifts: readonly EventUplift[];
  eventSummary: string;
  stockLastCountedAt: string;
  stockWasteRows?: readonly Readonly<{
    id: string;
    skuId: string;
    quantity: number;
    reason: WasteReason;
    loggedAt: string;
  }>[];
  laborShifts?: readonly LaborShift[];
  onCall?: readonly OnCallStaff[];
}>;

const TUESDAY_SHIFTS = [
  { staffId: "s01", name: "Amara Osei", daypart: "lunch", hours: 8, status: "scheduled" },
  { staffId: "s03", name: "Hana Kimura", daypart: "lunch", hours: 7, status: "scheduled" },
  { staffId: "s05", name: "Priya Nair", daypart: "dinner", hours: 8, status: "scheduled" },
  { staffId: "s07", name: "Sofia Marino", daypart: "dinner", hours: 8, status: "scheduled" },
  { staffId: "s10", name: "Jonas Weber", daypart: "dinner", hours: 6, status: "scheduled" },
  { staffId: "s11", name: "Rosa Alvarez", daypart: "prep", hours: 7, status: "scheduled" },
] as const satisfies readonly LaborShift[];

const ON_CALL = [
  { staffId: "oc1", name: "Nadia Haddad" },
  { staffId: "oc2", name: "Sam O'Neill" },
] as const satisfies readonly OnCallStaff[];

export const PRESETS: Readonly<Record<PresetId, PresetDefinition>> = {
  saturday: {
    id: "saturday",
    label: "Sat 5 Sep · derby weekend",
    serviceLabel: "Sat 5 Sep",
    cutoffLabel: "Fri 4 Sep",
    serviceDate: "2026-09-05",
    cutoffAt: "2026-09-04T22:00:00",
    deliveryAt: "2026-09-05T06:30:00",
    baseCovers: 830,
    seedCovers: 1_140,
    eventUplifts: [{ id: "derby-match", covers: 310 }],
    eventSummary: "Derby uplift +310",
    stockLastCountedAt: "2026-09-04T15:00:00.000Z",
  },
  tuesday: {
    id: "tuesday",
    label: "Tue 8 Sep · rainy midweek",
    serviceLabel: "Tue 8 Sep",
    cutoffLabel: "Mon 7 Sep",
    serviceDate: "2026-09-08",
    cutoffAt: "2026-09-07T22:00:00",
    deliveryAt: "2026-09-08T06:30:00",
    baseCovers: 520,
    seedCovers: 520,
    eventUplifts: [],
    eventSummary: "No event uplift",
    stockLastCountedAt: "2026-09-07T15:00:00.000Z",
    stockWasteRows: [
      {
        id: "waste-tuesday-chicken-prep",
        skuId: "chicken",
        quantity: 1,
        reason: "prep",
        loggedAt: "2026-09-07T18:00:00.000Z",
      },
    ],
    laborShifts: TUESDAY_SHIFTS,
    onCall: ON_CALL,
  },
};

export function getPreset(presetId: PresetId): PresetDefinition {
  return PRESETS[presetId];
}

export function isPresetId(value: string): value is PresetId {
  return PRESET_IDS.some((presetId) => presetId === value);
}
