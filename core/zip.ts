/**
 * Minimal, dependency-free ZIP reader. Enough to unpack the small `.skill`
 * archives downloaded from the Claude web app (a single folder with a SKILL.md
 * and optional support files). Node-only.
 *
 * It parses the End-Of-Central-Directory record, walks the central directory,
 * and inflates each entry with `node:zlib`. Only STORED (0) and DEFLATE (8) —
 * the two methods real-world ZIPs use — are supported; ZIP64 is not (these
 * archives are far below the 4 GB / 65k-entry limits).
 */

import zlib from 'node:zlib'

const SIG_EOCD = 0x06054b50 // End of central directory record
const SIG_CDH = 0x02014b50 // Central directory file header
const SIG_LFH = 0x04034b50 // Local file header

// Anti-zip-bomb caps. `.skill` archives are tiny (a few KB); these generous
// limits keep a maliciously crafted archive from inflating to gigabytes and
// OOM-killing the process.
const MAX_ENTRY_BYTES = 64 * 1024 * 1024 // per-entry decompressed/raw size
const MAX_TOTAL_BYTES = 256 * 1024 * 1024 // across all entries

export interface ZipEntry {
  /** Entry path inside the archive, always forward-slash separated. */
  path: string
  /** Decompressed contents (empty for directory entries). */
  data: Buffer
  isDirectory: boolean
}

/** Locate the EOCD record by scanning backwards over the optional comment. */
function findEocd(buf: Buffer): number {
  if (buf.length < 22) return -1
  const minOffset = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i
  }
  return -1
}

export function readZip(buffer: Buffer): ZipEntry[] {
  const eocd = findEocd(buffer)
  if (eocd < 0) throw new Error('Not a valid ZIP archive (no EOCD record)')

  const entryCount = buffer.readUInt16LE(eocd + 10)
  const cdOffset = buffer.readUInt32LE(eocd + 16)

  const entries: ZipEntry[] = []
  let p = cdOffset
  let totalBytes = 0

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(p) !== SIG_CDH) {
      throw new Error('Corrupt ZIP: bad central directory header')
    }
    const method = buffer.readUInt16LE(p + 10)
    const compSize = buffer.readUInt32LE(p + 20)
    const nameLen = buffer.readUInt16LE(p + 28)
    const extraLen = buffer.readUInt16LE(p + 30)
    const commentLen = buffer.readUInt16LE(p + 32)
    const localOffset = buffer.readUInt32LE(p + 42)
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen)

    // Jump to the local header to find where the file data actually starts
    // (its name/extra lengths can differ from the central directory's).
    if (buffer.readUInt32LE(localOffset) !== SIG_LFH) {
      throw new Error('Corrupt ZIP: bad local file header')
    }
    const lNameLen = buffer.readUInt16LE(localOffset + 26)
    const lExtraLen = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + lNameLen + lExtraLen
    const isDirectory = name.endsWith('/')

    let data: Buffer
    if (isDirectory) {
      data = Buffer.alloc(0)
    } else {
      // Guard against a header pointing the compressed data outside the buffer,
      // and against an oversized entry, before we ever slice or inflate.
      if (dataStart < 0 || dataStart + compSize > buffer.length) {
        throw new Error(`Corrupt ZIP: entry data out of bounds for ${name}`)
      }
      if (compSize > MAX_ENTRY_BYTES) {
        throw new Error(`ZIP entry too large for ${name}`)
      }
      const slice = buffer.subarray(dataStart, dataStart + compSize)
      if (method === 0) {
        data = slice
      } else if (method === 8) {
        data = zlib.inflateRawSync(slice, { maxOutputLength: MAX_ENTRY_BYTES })
      } else {
        throw new Error(
          `Unsupported ZIP compression method ${method} for ${name}`,
        )
      }
    }

    totalBytes += data.length
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('ZIP archive expands beyond the allowed total size')
    }

    entries.push({ path: name.replace(/\\/g, '/'), data, isDirectory })
    p += 46 + nameLen + extraLen + commentLen
  }

  return entries
}

// --- Writer (STORED only) ---------------------------------------------------

let crcTable: number[] | null = null
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipWriteEntry {
  path: string
  data: Buffer
}

/**
 * Build a ZIP buffer using the STORED method (no compression). Enough to produce
 * the small `.skill` archives we export — the reader above unpacks STORED fine.
 */
export function writeZip(entries: ZipWriteEntry[]): Buffer {
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.path.replace(/\\/g, '/'), 'utf8')
    const crc = crc32(entry.data)
    const size = entry.data.length

    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(SIG_LFH, 0)
    lfh.writeUInt16LE(20, 4)
    lfh.writeUInt16LE(0, 6)
    lfh.writeUInt16LE(0, 8) // method STORED
    lfh.writeUInt16LE(0, 10)
    lfh.writeUInt16LE(0x21, 12) // 1980-01-01
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(size, 18)
    lfh.writeUInt32LE(size, 22)
    lfh.writeUInt16LE(name.length, 26)
    lfh.writeUInt16LE(0, 28)
    local.push(lfh, name, entry.data)

    const cdh = Buffer.alloc(46)
    cdh.writeUInt32LE(SIG_CDH, 0)
    cdh.writeUInt16LE(20, 4)
    cdh.writeUInt16LE(20, 6)
    cdh.writeUInt16LE(0, 8)
    cdh.writeUInt16LE(0, 10)
    cdh.writeUInt16LE(0, 12)
    cdh.writeUInt16LE(0x21, 14)
    cdh.writeUInt32LE(crc, 16)
    cdh.writeUInt32LE(size, 20)
    cdh.writeUInt32LE(size, 24)
    cdh.writeUInt16LE(name.length, 28)
    cdh.writeUInt16LE(0, 30)
    cdh.writeUInt16LE(0, 32)
    cdh.writeUInt16LE(0, 34)
    cdh.writeUInt16LE(0, 36)
    cdh.writeUInt32LE(0, 38)
    cdh.writeUInt32LE(offset, 42)
    central.push(cdh, name)

    offset += lfh.length + name.length + size
  }

  const cd = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(SIG_EOCD, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...local, cd, eocd])
}
