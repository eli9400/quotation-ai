import 'dotenv/config'
import { getFirestoreDb, initializeFirebaseIfConfigured } from '../src/config/firebase.js'
import {
  SERVICE_PROVIDER_INTAKE_TEMPLATES_COLLECTION,
  seedDefaultIntakeTemplatesToFirestore,
} from '../src/services/service-provider-intake-templates.service.js'

async function main() {
  const configured = initializeFirebaseIfConfigured()
  if (!configured) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          message:
            'Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* env vars.',
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const result = await seedDefaultIntakeTemplatesToFirestore()
  const db = getFirestoreDb()
  const snapshot = await db.collection(SERVICE_PROVIDER_INTAKE_TEMPLATES_COLLECTION).count().get()
  const total = snapshot.data().count
  console.log(
    JSON.stringify(
      {
        ok: true,
        collection: SERVICE_PROVIDER_INTAKE_TEMPLATES_COLLECTION,
        upserted: result.upserted,
        totalDocuments: total,
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

