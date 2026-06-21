export type CsvCell = string | number | boolean | null | undefined;

export function toCsv(rows: CsvCell[][]) {
  return rows
    .map((row) => row.map((cell) => serializeCsvCell(cell)).join(','))
    .join('\n');
}

export function serializeCsvCell(cell: CsvCell) {
  const value = cell == null ? '' : String(cell);
  const formulaCandidate = value.trimStart();
  const safeValue = /^[=+\-@]/.test(formulaCandidate) || /^[\t\r\n]/.test(value)
    ? `'${value}`
    : value;

  return `"${safeValue.replace(/"/g, '""')}"`;
}
