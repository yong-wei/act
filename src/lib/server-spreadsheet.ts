import { readSheet } from 'read-excel-file/universal';
import writeXlsxFile from 'write-excel-file/node';

type SpreadsheetCellValue = string | number | boolean | Date | null;

export async function loadFirstWorksheetRows(arrayBuffer: ArrayBuffer) {
  return readSheet(arrayBuffer, { trim: false });
}

export async function buildWorkbookBuffer(
  sheetName: string,
  rows: Array<Array<string>>
) {
  const buffer = await writeXlsxFile(rows as SpreadsheetCellValue[][], {
    sheet: sheetName,
  }).toBuffer();

  return buffer;
}
