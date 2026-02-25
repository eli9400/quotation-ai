import type { DocumentValidation, UploadedDocument } from '../../types/quotation'
import { formatMegabytes } from '../../utils/formatters'
import { Panel } from '../ui/Panel'

type DocumentsPanelProps = {
  documents: UploadedDocument[]
  documentValidationById: Record<string, DocumentValidation>
  isUploading: boolean
  isValidatingDocuments: boolean
  onFilesSelected: (files: FileList | null) => void
  onRemoveDocument: (documentId: string) => void
  onClearDocuments: () => void
}

const FALLBACK_VALIDATION: DocumentValidation = {
  status: 'unchecked',
  reason: null,
  heuristicLineItems: 0,
  signalScore: 0,
}

function toValidationLabel(status: DocumentValidation['status']): string {
  if (status === 'checking') return 'בבדיקה'
  if (status === 'valid') return 'תקין'
  if (status === 'corrupted') return 'פגום'
  return 'לא נבדק'
}

function toValidationClassName(status: DocumentValidation['status']): string {
  if (status === 'checking') return 'checking'
  if (status === 'valid') return 'valid'
  if (status === 'corrupted') return 'corrupted'
  return 'unchecked'
}

export function DocumentsPanel({
  documents,
  documentValidationById,
  isUploading,
  isValidatingDocuments,
  onFilesSelected,
  onRemoveDocument,
  onClearDocuments,
}: DocumentsPanelProps) {
  const isBusy = isUploading || isValidatingDocuments

  const validationSummary = documents.reduce(
    (acc, document) => {
      const status = (documentValidationById[document.id] ?? FALLBACK_VALIDATION).status
      if (status === 'valid') acc.valid += 1
      else if (status === 'corrupted') acc.corrupted += 1
      else if (status === 'checking') acc.checking += 1
      else acc.unchecked += 1
      return acc
    },
    { valid: 0, corrupted: 0, checking: 0, unchecked: 0 },
  )

  const handleClearAll = () => {
    if (documents.length === 0) return
    const confirmed = window.confirm('למחוק את כל הקבצים שממתינים לאימון?')
    if (!confirmed) return
    onClearDocuments()
  }

  return (
    <Panel title="מסמכי אימון">
      <label className="upload-box" htmlFor="docsUpload">
        <input
          id="docsUpload"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
          multiple
          disabled={isBusy}
          onChange={(event) => {
            onFilesSelected(event.target.files)
            event.currentTarget.value = ''
          }}
        />
        <strong>
          {isUploading ? 'מעלה קבצים...' : isValidatingDocuments ? 'בודק תקינות קבצים...' : 'לחצו להעלאת קבצים'}
        </strong>
        <small>PDF, DOCX, XLS, XLSX, CSV (אפשר כמה קבצים ביחד)</small>
      </label>

      {documents.length === 0 ? (
        <p className="empty">אין קבצים חדשים שממתינים לאימון.</p>
      ) : (
        <>
          <p className="doc-validation-summary">
            {validationSummary.corrupted > 0
              ? `תקינים: ${validationSummary.valid} | פגומים: ${validationSummary.corrupted} | בבדיקה: ${validationSummary.checking}`
              : `תקינים: ${validationSummary.valid} | בבדיקה: ${validationSummary.checking} | לא נבדקו: ${validationSummary.unchecked}`}
          </p>
          <div className="doc-list-actions">
            <button
              type="button"
              className="doc-clear-btn"
              disabled={isBusy}
              onClick={handleClearAll}
            >
              נקה קבצים
            </button>
          </div>
          <ul className="doc-list">
            {documents.map((doc) => {
              const validation = documentValidationById[doc.id] ?? FALLBACK_VALIDATION
              return (
                <li key={doc.id} className={`doc-list-item ${toValidationClassName(validation.status)}`}>
                  <div>
                    <p>{doc.name}</p>
                    <div className="doc-meta-row">
                      <small>
                        {formatMegabytes(doc.size)} | {doc.uploadedAt}
                      </small>
                      <span className={`doc-validation-badge ${toValidationClassName(validation.status)}`}>
                        {toValidationLabel(validation.status)}
                      </span>
                    </div>
                    {validation.status === 'corrupted' && validation.reason ? (
                      <p className="doc-validation-reason">{validation.reason}</p>
                    ) : null}
                  </div>
                  <button type="button" disabled={isBusy} onClick={() => onRemoveDocument(doc.id)}>
                    הסר
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Panel>
  )
}
