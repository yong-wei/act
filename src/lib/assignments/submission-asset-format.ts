import JSZip from 'jszip';

const PDF_HEADER = Buffer.from('%PDF-');
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_MAX_ENTRIES = 2_048;
const ZIP_MAX_ENTRY_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const ZIP_MAX_TOTAL_UNCOMPRESSED_BYTES = 128 * 1024 * 1024;
const ZIP_MAX_COMPRESSION_RATIO = 200;

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
    const entryNames = inspectZipCentralDirectory(buffer);
    if (!entryNames?.has(rootEntry)) return false;
    const archive = await JSZip.loadAsync(buffer, {
      checkCRC32: false,
      createFolders: false,
    });
    return Boolean(archive.file(rootEntry));
  } catch {
    return false;
  }
}

function inspectZipCentralDirectory(buffer: Buffer): Set<string> | null {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) return null;

  const disk = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  if (disk !== 0
    || centralDirectoryDisk !== 0
    || entriesOnDisk !== entryCount
    || entryCount > ZIP_MAX_ENTRIES
    || entryCount === 0xffff
    || centralDirectorySize === 0xffffffff
    || centralDirectoryOffset === 0xffffffff
    || centralDirectoryOffset + centralDirectorySize > endOffset) {
    return null;
  }

  const names = new Set<string>();
  let totalUncompressedBytes = 0;
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > endOffset || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_FILE_HEADER) {
      return null;
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const uncompressedBytes = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if ((flags & 0x1) !== 0
      || ![0, 8].includes(compressionMethod)
      || compressedBytes === 0xffffffff
      || uncompressedBytes === 0xffffffff
      || uncompressedBytes > ZIP_MAX_ENTRY_UNCOMPRESSED_BYTES
      || nextOffset > endOffset) {
      return null;
    }
    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > ZIP_MAX_TOTAL_UNCOMPRESSED_BYTES
      || uncompressedBytes > Math.max(1024 * 1024, compressedBytes * ZIP_MAX_COMPRESSION_RATIO)) {
      return null;
    }
    names.add(buffer.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset = nextOffset;
  }
  return offset === centralDirectoryOffset + centralDirectorySize ? names : null;
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
