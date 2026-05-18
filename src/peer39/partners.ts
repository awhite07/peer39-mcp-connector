// Source of truth: Peer39 internal "Symphony accounts" partner list.
// Test/sandbox/monitor accounts are intentionally omitted.
// Aliases included where partners have been rebranded.
export const PARTNER_NAME_TO_ID: Readonly<Record<string, number>> = Object.freeze({
  'mediamath': 730,
  'microsoft-advertising': 841,
  'xandr': 841,
  'nexxen': 1341,
  'perion': 1352,
  'illumin': 1385,
  'zeta-dsp': 1402,
  'zeta': 1402,
  'the-trade-desk': 1407,
  'ttd': 1407,
  'basis-technologies': 1419,
  'basis': 1419,
  'yahoo': 1423,
  'verizon-media': 1423,
  'adobe': 1438,
  'adform': 1481,
  'sky': 1497,
  'viant': 1501,
  'bidtellect': 1513,
  'deepintent': 1516,
  'index-exchange': 1524,
  'adtheorent': 1525,
  'sportradar': 1527,
  'reticle': 1528,
  'equativ': 1529,
  'blis': 1530,
  'amazon': 1532,
  'amazon-publisher-services': 1534,
  'aps': 1534,
  'genius-sports': 1536,
  'freewheel': 1544,
  'the-philadelphia-inquirer': 1545,
  'the-media-trust': 1647,
  'adobe-dsp': 1649,
});

export function partnerIdToName(id: number): string | undefined {
  for (const [name, partnerId] of Object.entries(PARTNER_NAME_TO_ID)) {
    if (partnerId === id) return name;
  }
  return undefined;
}

export function resolvePartnerId(input: number | string): number {
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input <= 0) {
      throw new Error(`Partner ID must be a positive integer; got ${input}.`);
    }
    return input;
  }
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n <= 0) throw new Error(`Partner ID must be a positive integer; got ${input}.`);
    return n;
  }
  const key = trimmed.toLowerCase();
  const id = PARTNER_NAME_TO_ID[key];
  if (id === undefined) {
    throw new Error(
      `Unknown partner name "${input}". Known names: ${Object.keys(PARTNER_NAME_TO_ID).join(', ')}. ` +
      `Pass a numeric partner ID instead — see https://app.peer39.com/partners.`,
    );
  }
  return id;
}
