const MOJIBAKE_MARKERS = /[ÃÂÐÑ×ØÙÚÛÜÝÞß]/g
const REPLACEMENT_CHAR = '�'

function countMatches(value: string, pattern: RegExp): number {
  const matches = value.match(pattern)
  return matches ? matches.length : 0
}

function countHebrewLetters(value: string): number {
  return countMatches(value, /[\u0590-\u05FF]/g)
}

function scoreNameQuality(value: string): number {
  if (!value) return -100
  const hebrewLetters = countHebrewLetters(value)
  const mojibakeCount = countMatches(value, MOJIBAKE_MARKERS)
  const replacementCount = countMatches(value, /\uFFFD/g)
  const printableChars = countMatches(value, /[A-Za-z0-9\u0590-\u05FF._\-\s]/g)
  return hebrewLetters * 3 + printableChars - mojibakeCount * 4 - replacementCount * 8
}

function decodeLatin1AsUtf8(value: string): string {
  try {
    return Buffer.from(value, 'latin1').toString('utf8')
  } catch {
    return value
  }
}

function sanitizeControlChars(value: string): string {
  let output = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    if ((code >= 32 && code !== 127) || code > 255) {
      output += char
    }
  }
  return output.trim()
}

export function normalizeOriginalFileName(fileName: string): string {
  const original = sanitizeControlChars(fileName)
  if (!original) return fileName
  if (countMatches(original, MOJIBAKE_MARKERS) === 0 && !original.includes(REPLACEMENT_CHAR)) {
    return original
  }

  const decoded = sanitizeControlChars(decodeLatin1AsUtf8(original))
  if (!decoded) return original

  const originalScore = scoreNameQuality(original)
  const decodedScore = scoreNameQuality(decoded)
  return decodedScore > originalScore ? decoded : original
}
