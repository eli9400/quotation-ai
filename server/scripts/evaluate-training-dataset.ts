import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import {
  getTrainingDatasetStats,
  listTrainingDatasetExamples,
} from '../src/services/training-dataset.service.js'
import {
  buildTrainingEvaluationReport,
  evaluateSplitWithMedianBaseline,
  renderTrainingEvaluationMarkdown,
} from '../src/services/model-evaluation.service.js'
import {
  buildModelFeatureRowFromDatasetExample,
  getModelFeatureSchema,
  validateModelFeatureRow,
} from '../src/services/model-feature-schema.service.js'
import {
  buildRandomEvaluationSplit,
  buildTimeEvaluationSplit,
} from '../src/services/model-evaluation-split.service.js'

function argValue(name: string): string | null {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (!prefixed) return null
  const value = prefixed.split('=').slice(1).join('=').trim()
  return value.length > 0 ? value : null
}

function requiredUid(): string {
  const uid = argValue('--uid')
  if (!uid) throw new Error('Missing required argument --uid=<serviceProviderUid>')
  return uid
}

function optionalRatio(): number {
  const raw = argValue('--testRatio')
  if (!raw) return 0.2
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new Error('Invalid --testRatio value')
  return parsed
}

async function writeOptionalFile(targetPath: string | null, content: string): Promise<string | null> {
  if (!targetPath) return null
  const resolved = path.resolve(targetPath)
  await fs.mkdir(path.dirname(resolved), { recursive: true })
  await fs.writeFile(resolved, content, 'utf8')
  return resolved
}

async function run(): Promise<void> {
  const uid = requiredUid()
  const testRatio = optionalRatio()
  const jsonPath = argValue('--outJson')
  const mdPath = argValue('--outMd')

  if (!initializeFirebaseIfConfigured()) {
    throw new Error('Firebase is not configured')
  }

  const [examples, stats] = await Promise.all([
    listTrainingDatasetExamples(uid),
    getTrainingDatasetStats(uid),
  ])
  if (examples.length < 2) {
    throw new Error(`Not enough dataset examples for evaluation (found ${examples.length})`)
  }
  const schema = getModelFeatureSchema()
  const invalidRows = examples
    .map((example) => ({ id: example.id, errors: validateModelFeatureRow(buildModelFeatureRowFromDatasetExample(example)) }))
    .filter((row) => row.errors.length > 0)
  if (invalidRows.length > 0) {
    throw new Error(
      `Feature schema ${schema.version} validation failed for ${invalidRows.length} rows. Example: ${invalidRows[0].id} -> ${invalidRows[0].errors.join(',')}`,
    )
  }

  const randomSplit = buildRandomEvaluationSplit(examples, testRatio)
  const timeSplit = buildTimeEvaluationSplit(examples, testRatio)
  const randomSummary = evaluateSplitWithMedianBaseline(randomSplit)
  const timeSummary = evaluateSplitWithMedianBaseline(timeSplit)

  const report = buildTrainingEvaluationReport({
    serviceProviderUid: uid,
    examples,
    datasetVersionId: stats?.datasetVersionId ?? null,
    datasetFingerprint: stats?.datasetFingerprint ?? null,
    summaries: [randomSummary, timeSummary],
  })
  const markdown = renderTrainingEvaluationMarkdown(report)

  const jsonOutput = JSON.stringify({ ok: true, report }, null, 2)
  const [jsonWritten, mdWritten] = await Promise.all([
    writeOptionalFile(jsonPath, jsonOutput),
    writeOptionalFile(mdPath, markdown),
  ])

  console.log(jsonOutput)
  console.log('\n---MARKDOWN---\n')
  console.log(markdown)
  if (jsonWritten || mdWritten) {
    console.log(
      JSON.stringify(
        {
          files: {
            json: jsonWritten,
            markdown: mdWritten,
          },
        },
        null,
        2,
      ),
    )
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ ok: false, message }, null, 2))
  process.exitCode = 1
})
