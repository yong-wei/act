import { describe, expect, it } from 'vitest';

import { serializeCsvCell, toCsv } from '../csv-export';

describe('CSV export serializer', () => {
  it('escapes spreadsheet formula prefixes before CSV quote escaping', () => {
    expect(serializeCsvCell('=cmd"quote')).toBe(`"'=cmd""quote"`);
    expect(serializeCsvCell('+mail@example.test')).toBe(`"'+mail@example.test"`);
    expect(serializeCsvCell('-20240003')).toBe(`"'-20240003"`);
    expect(serializeCsvCell('@employee')).toBe(`"'@employee"`);
    expect(serializeCsvCell(' @class"2401')).toBe(`"' @class""2401"`);
  });

  it('serializes nullable and scalar rows with stable quoting', () => {
    expect(toCsv([
      ['row', 'account', 'active'],
      [1, null, true],
    ])).toBe('"row","account","active"\n"1","","true"');
  });
});
