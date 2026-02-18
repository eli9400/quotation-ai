import { readFile } from 'node:fs/promises'
import path from 'node:path'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import * as XLSX from 'xlsx'
import { env } from '../config/env.js'
import type { StoredDocument } from '../types/document.js'

export type ExtractedDocumentText = {
  documentId: string
  originalName: string
  detectedFormat: 'pdf' | 'docx' | 'xls' | 'xlsx' | 'csv'
  text: string
}

function normalizeText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function resolveStoredFilePath(storedName: string): string {
  const safeFileName = path.basename(storedName)
  return path.join(env.uploadsDir, safeFileName)
}

function detectFormat(
  file: StoredDocument,
): ExtractedDocumentText['detectedFormat'] | null {
  const extension = path.extname(file.originalName || file.storedName).toLowerCase()
  if (extension === '.pdf' || file.mimeType === 'application/pdf') {
    return 'pdf'
  }
  if (
    extension === '.docx' ||
    file.mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx'
  }
  if (extension === '.xls' || file.mimeType === 'application/vnd.ms-excel') {
    return 'xls'
  }
  if (
    extension === '.xlsx' ||
    file.mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx'
  }
  if (extension === '.csv' || file.mimeType === 'text/csv' || file.mimeType === 'application/csv') {
    return 'csv'
  }
  return null
}

async function extractPdfText(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath)
  const parser = new PDFParse({ data: fileBuffer })
  try {
    const parsed = await parser.getText()
    return normalizeText(parsed.text || '')
  } finally {
    await parser.destroy()
  }
}

async function extractDocxText(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath })
  return normalizeText(result.value || '')
}

function normalizeCell(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).replace(/\s+/g, ' ').trim()
}

function worksheetToText(sheet: XLSX.WorkSheet): string {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })

  return rows
    .map((row) => row.map(normalizeCell).filter((cell) => cell.length > 0).join('\t'))
    .filter((line) => line.length > 0)
    .join('\n')
}

async function extractSpreadsheetText(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath)
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: false })
  const allSheetText = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      return ''
    }
    const lines = worksheetToText(sheet)
    if (!lines) {
      return ''
    }
    return `# ${sheetName}\n${lines}`
  })
    .filter((block) => block.length > 0)
    .join('\n\n')

  return normalizeText(allSheetText)
}

export async function extractTextFromStoredDocument(
  document: StoredDocument,
): Promise<ExtractedDocumentText> {
  const format = detectFormat(document)
  if (!format) {
    throw new Error(
      `Unsupported document format: ${document.originalName}. Supported: PDF, DOCX, XLS, XLSX, CSV.`,
    )
  }

  const filePath = resolveStoredFilePath(document.storedName)
  let text = ''
  if (format === 'pdf') {
    text = await extractPdfText(filePath)
  } else if (format === 'docx') {
    text = await extractDocxText(filePath)
  } else {
    text = await extractSpreadsheetText(filePath)
  }

  return {
    documentId: document.id,
    originalName: document.originalName,
    detectedFormat: format,
    text,
  }
}

export async function extractTextFromDocuments(
  documents: StoredDocument[],
): Promise<ExtractedDocumentText[]> {
  const extracted: ExtractedDocumentText[] = []
  for (const document of documents) {
    extracted.push(await extractTextFromStoredDocument(document))
  }
  return extracted
}
