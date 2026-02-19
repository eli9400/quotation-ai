import type { UploadedDocument } from '../../types/quotation'
import { formatMegabytes } from '../../utils/formatters'
import { Panel } from '../ui/Panel'

type DocumentsPanelProps = {
  documents: UploadedDocument[]
  isUploading: boolean
  onFilesSelected: (files: FileList | null) => void
  onRemoveDocument: (documentId: string) => void
}

export function DocumentsPanel({
  documents,
  isUploading,
  onFilesSelected,
  onRemoveDocument,
}: DocumentsPanelProps) {
  return (
    <Panel title="מסמכי אימון">
      <label className="upload-box" htmlFor="docsUpload">
        <input
          id="docsUpload"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
          multiple
          disabled={isUploading}
          onChange={(event) => {
            onFilesSelected(event.target.files)
            event.currentTarget.value = ''
          }}
        />
        <strong>{isUploading ? 'מעלה קבצים...' : 'לחצו להעלאת קבצים'}</strong>
        <small>PDF, DOCX, XLS, XLSX, CSV (אפשר כמה קבצים ביחד)</small>
      </label>

      {documents.length === 0 ? (
        <p className="empty">אין קבצים חדשים שממתינים לאימון.</p>
      ) : (
        <ul className="doc-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <div>
                <p>{doc.name}</p>
                <small>
                  {formatMegabytes(doc.size)} | {doc.uploadedAt}
                </small>
              </div>
              <button type="button" disabled={isUploading} onClick={() => onRemoveDocument(doc.id)}>
                הסר
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
