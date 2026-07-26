import JSZip from 'jszip';

const PDF_HEADER = Buffer.from('%PDF-');
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

export async function matchesDeclaredAssignmentAssetFormat(
  bytes: Uint8Array,
  mimeType: string,
): Promise<boolean> {
  const buffer = Buffer.from(bytes);
  if (mimeType === 'application/pdf') return buffer.subarray(0, PDF_HEADER.length).equals(PDF_HEADER);
  if (mimeType === 'image/png') return buffer.subarray(0, PNG_HEADER.length).equals(PNG_HEADER);
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 4
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[buffer.length - 2] === 0xff
      && buffer[buffer.length - 1] === 0xd9;
  }
  if (mimeType === 'application/msword') {
    return buffer.subarray(0, OLE_HEADER.length).equals(OLE_HEADER)
      && buffer.includes(Buffer.from('WordDocument', 'utf16le'));
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return zipContainsOfficeRoot(buffer, 'word/document.xml');
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return zipContainsOfficeRoot(buffer, 'ppt/presentation.xml');
  }
  if (mimeType === 'text/markdown' || mimeType === 'text/plain') return isPlainUtf8Text(buffer);
  return false;
}

async function zipContainsOfficeRoot(buffer: Buffer, rootEntry: string): Promise<boolean> {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;
  try {
    const archive = await JSZip.loadAsync(buffer, {
      checkCRC32: true,
      createFolders: false,
    });
    return Boolean(archive.file(rootEntry));
  } catch {
    return false;
  }
}

function isPlainUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}
