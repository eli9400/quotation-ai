import 'dotenv/config'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { env } from '../src/config/env.js'
import {
  getFirestoreDb,
  getStorageBucket,
  initializeFirebaseIfConfigured,
} from '../src/config/firebase.js'
import { buildDocumentStorageObjectPath } from '../src/services/document-storage.service.js'

type RawStoredDocument = {
  id?: unknown
  serviceProviderUid?: unknown
  contractorUid?: unknown
  storedName?: unknown
  originalName?: unknown
  mimeType?: unknown
}

type ParsedArgs = {
  serviceProviderUid: string | null
  uploadsDir: string
  force: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  let serviceProviderUid: string | null = null
  let uploadsDir = env.uploadsDir
  let force = false

  argv.forEach((arg) => {
    if (arg.startsWith('--uid=')) {
      serviceProviderUid = arg.slice('--uid='.length).trim() || null
      return
    }
    if (arg.startsWith('--uploads-dir=')) {
      const value = arg.slice('--uploads-dir='.length).trim()
      if (value) uploadsDir = path.resolve(value)
      return
    }
    if (arg === '--force') {
      force = true
    }
  })

  return { serviceProviderUid, uploadsDir: path.resolve(uploadsDir), force }
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function loadRawDocuments(serviceProviderUid: string | null): Promise<RawStoredDocument[]> {
  const db = getFirestoreDb()
  const collection = db.collection('documents')

  if (serviceProviderUid) {
    const [newSnapshot, legacySnapshot] = await Promise.all([
      collection.where('serviceProviderUid', '==', serviceProviderUid).get(),
      collection.where('contractorUid', '==', serviceProviderUid).get(),
    ])
    const docs = [...newSnapshot.docs, ...legacySnapshot.docs]
    const unique = new Map<string, RawStoredDocument>()
    docs.forEach((doc) => unique.set(doc.id, doc.data() as RawStoredDocument))
    return Array.from(unique.values())
  }

  const snapshot = await collection.get()
  return snapshot.docs.map((doc) => doc.data() as RawStoredDocument)
}

async function main() {
  const configured = initializeFirebaseIfConfigured()
  if (!configured) {
    throw new Error('Firebase is not configured. Check server/.env credentials.')
  }

  const args = parseArgs(process.argv.slice(2))
  const bucket = getStorageBucket()
  const rawDocuments = await loadRawDocuments(args.serviceProviderUid)

  let uploaded = 0
  let skippedExists = 0
  let missingLocalFile = 0
  let invalidDocument = 0

  const missingExamples: string[] = []

  for (const raw of rawDocuments) {
    const serviceProviderUid =
      toStringValue(raw.serviceProviderUid) || toStringValue(raw.contractorUid)
    const storedName = toStringValue(raw.storedName)
    const mimeType = toStringValue(raw.mimeType) || 'application/octet-stream'
    const originalName = toStringValue(raw.originalName)

    if (!serviceProviderUid || !storedName) {
      invalidDocument += 1
      continue
    }

    const localPath = path.join(args.uploadsDir, path.basename(storedName))
    if (!existsSync(localPath)) {
      missingLocalFile += 1
      if (missingExamples.length < 20) {
        missingExamples.push(originalName || storedName)
      }
      continue
    }

    const objectPath = buildDocumentStorageObjectPath(serviceProviderUid, storedName)
    const file = bucket.file(objectPath)
    if (!args.force) {
      const [exists] = await file.exists()
      if (exists) {
        skippedExists += 1
        continue
      }
    }

    await bucket.upload(localPath, {
      destination: objectPath,
      metadata: {
        contentType: mimeType,
      },
    })
    uploaded += 1
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        serviceProviderUid: args.serviceProviderUid,
        uploadsDir: args.uploadsDir,
        force: args.force,
        totals: {
          scanned: rawDocuments.length,
          uploaded,
          skippedExists,
          missingLocalFile,
          invalidDocument,
        },
        missingExamples,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(JSON.stringify({ ok: false, message }, null, 2))
  process.exit(1)
})
