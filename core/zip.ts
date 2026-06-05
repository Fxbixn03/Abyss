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
    } else if (method === 0) {
      data = buffer.subarray(dataStart, dataStart + compSize)
    } else if (method === 8) {
      data = zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + compSize))
    } else {
      throw new Error(`Unsupported ZIP compression method ${method} for ${name}`)
    }

    entries.push({ path: name.replace(/\\/g, '/'), data, isDirectory })
    p += 46 + nameLen + extraLen + commentLen
  }

  return entries
}
