import { isPlainObject, normalizeBodyWeight } from "./storage.js";
import { isValidDateKey } from "./dates.js";

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
const MAX_FILES = 4000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

export function crc32(data) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dosDateTime(date) {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { time, date: dosDate };
}

export function createZip(files, now = new Date()) {
  const { time, date } = dosDateTime(now);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);
    const local = new Uint8Array(30);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, ZIP_LOCAL, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);

    const central = new Uint8Array(46);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, ZIP_CENTRAL, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);

    const localBytes = concat([local, nameBytes, data]);
    locals.push(localBytes);
    centrals.push(concat([central, nameBytes]));
    offset += localBytes.length;
  }

  const centralBytes = concat(centrals);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, ZIP_EOCD, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralBytes.length, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  return concat([...locals, centralBytes, eocd]);
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function findEocd(bytes) {
  const start = Math.max(0, bytes.length - 22 - 65535);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (readU32(bytes, offset) === ZIP_EOCD) return offset;
  }
  return -1;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("圧縮されたバックアップは、このブラウザでは読めないよ");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error("バックアップのZIPを読めなかったよ");

  const count = readU16(bytes, eocd + 10);
  const centralSize = readU32(bytes, eocd + 12);
  const centralOffset = readU32(bytes, eocd + 16);

  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("このバックアップ形式には対応していないよ");
  }
  if (count > MAX_FILES) throw new Error("バックアップのファイル数が多すぎるよ");

  const files = [];
  let cursor = centralOffset;
  let total = 0;
  const decoder = new TextDecoder();

  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || readU32(bytes, cursor) !== ZIP_CENTRAL) {
      throw new Error("バックアップの中身が壊れているよ");
    }

    const flags = readU16(bytes, cursor + 8);
    const method = readU16(bytes, cursor + 10);
    const compressedSize = readU32(bytes, cursor + 20);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (flags & 0x1) throw new Error("暗号化されたバックアップには対応していないよ");
    if (name.endsWith("/")) continue;
    if (method !== 0 && method !== 8) {
      throw new Error("このバックアップの圧縮形式には対応していないよ");
    }

    if (localOffset + 30 > bytes.length || readU32(bytes, localOffset) !== ZIP_LOCAL) {
      throw new Error("バックアップの中身が壊れているよ");
    }

    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error("バックアップの中身が壊れているよ");

    let data = bytes.subarray(dataStart, dataEnd);
    if (method === 8) data = await inflateRaw(data);
    if (data.length > MAX_FILE_BYTES) throw new Error("バックアップ内のファイルが大きすぎるよ");
    total += data.length;
    if (total > MAX_TOTAL_BYTES) throw new Error("バックアップが大きすぎるよ");
    files.push({ name, data });
  }

  return files;
}

export function isJpeg(bytes) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function parseBackupData(input) {
  const text = typeof input === "string" ? input : new TextDecoder().decode(input);
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("バックアップを読めなかったよ");
  }

  if (!isPlainObject(data)) throw new Error("バックアップの形式が違うよ");

  return {
    version: typeof data.version === "number" ? data.version : 1,
    newer: typeof data.version === "number" && data.version > 1,
    records: isPlainObject(data.records) ? data.records : {},
    dayParts: isPlainObject(data.dayParts) ? data.dayParts : {},
    customExercises: Array.isArray(data.customExercises) ? data.customExercises : [],
    lastExercises: isPlainObject(data.lastExercises) ? data.lastExercises : {},
    bodyWeight: normalizeBodyWeight(isPlainObject(data.bodyWeight) ? data.bodyWeight : {}),
  };
}

function ensureRecordId(record, date, index) {
  if (record.id) return record;
  return { ...record, id: `imported-${date}-${index}` };
}

export function mergeState(current, incoming) {
  const records = { ...current.records };
  let skipped = 0;

  for (const [date, list] of Object.entries(incoming.records || {})) {
    if (!isValidDateKey(date) || !Array.isArray(list)) {
      skipped += 1;
      continue;
    }

    const clean = list.filter((item) => isPlainObject(item) && item.exercise);
    if (clean.length === 0 && list.length > 0) {
      skipped += 1;
      continue;
    }

    records[date] = clean.map((item, index) => ensureRecordId(item, date, index));
  }

  const dayParts = { ...current.dayParts };
  for (const [date, part] of Object.entries(incoming.dayParts || {})) {
    if (isValidDateKey(date) && typeof part === "string") dayParts[date] = part;
  }

  const bodyWeight = { ...current.bodyWeight, ...normalizeBodyWeight(incoming.bodyWeight) };
  const seen = new Set(
    (current.customExercises || []).map((item) => `${item.part}::${item.name}`)
  );
  const customExercises = [...(current.customExercises || [])];

  for (const item of incoming.customExercises || []) {
    if (!item?.name) continue;
    const part = item.part || "other";
    const key = `${part}::${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    customExercises.push({
      ...item,
      id: item.id || `imported-${customExercises.length}-${item.name}`,
      name: String(item.name),
      part,
    });
  }

  const lastExercises = { ...current.lastExercises };
  for (const [part, name] of Object.entries(incoming.lastExercises || {})) {
    if (typeof name === "string" && name) lastExercises[part] = name;
  }

  return {
    records,
    dayParts,
    bodyWeight,
    customExercises,
    lastExercises,
    skipped,
  };
}

export function summarizeBackup(data, photoCount) {
  const days = Object.keys(data.records || {}).length;
  const weights = Object.keys(data.bodyWeight || {}).length;
  return {
    days,
    weights,
    exercises: (data.customExercises || []).length,
    photos: photoCount,
  };
}

export function buildBackupPayload(state) {
  return {
    app: "workout-memo",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: state.records,
    dayParts: state.dayParts,
    customExercises: state.customExercises,
    lastExercises: state.lastExercises,
    bodyWeight: state.bodyWeight,
  };
}

export async function createBackupZip(state, photos) {
  const payload = buildBackupPayload(state);
  const files = [
    {
      name: "data.json",
      data: new TextEncoder().encode(JSON.stringify(payload)),
    },
  ];

  for (const photo of photos) {
    if (!isValidDateKey(photo.dateKey) || !photo.blob) continue;
    files.push({
      name: `photos/${photo.dateKey}.jpg`,
      data: new Uint8Array(await photo.blob.arrayBuffer()),
    });
  }

  return createZip(files);
}

export async function readBackupFile(file) {
  if (file.size > MAX_TOTAL_BYTES) throw new Error("ファイルが大きすぎるよ");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder().decode(bytes.subarray(0, 32)).trimStart();

  if (head.startsWith("{")) {
    return { data: parseBackupData(bytes), photos: [] };
  }

  const files = await unzip(bytes);
  const dataFile = files.find((entry) => entry.name === "data.json" || entry.name.endsWith("/data.json"));
  if (!dataFile) throw new Error("バックアップの中にデータがなかったよ");

  const photos = [];
  for (const entry of files) {
    const match = entry.name.match(/(?:^|\/)photos\/(\d{4}-\d{2}-\d{2})\.jpe?g$/i);
    if (!match || !isValidDateKey(match[1]) || !isJpeg(entry.data)) continue;
    photos.push({
      dateKey: match[1],
      blob: new Blob([entry.data], { type: "image/jpeg" }),
    });
  }

  return { data: parseBackupData(dataFile.data), photos };
}
