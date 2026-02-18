import { formatMegabytes } from '../../utils/formatters'
import type { UploadedDocument } from '../../types/quotation'
import { Panel } from '../ui/Panel'

type DocumentsPanelProps = {
  documents: UploadedDocument[]
  onFilesSelected: (files: FileList | null) => void
  onRemoveDocument: (documentId: string) => void
}

export function DocumentsPanel({
  documents,
  onFilesSelected,
  onRemoveDocument,
}: DocumentsPanelProps) {
  return (
    <Panel title="מסמכי אימון">
      <label className="upload-box" htmlFor="docsUpload">
        <input
          id="docsUpload"
          type="file"
          accept=".pdf,.doc,.docx"
          multiple
          onChange={(event) => onFilesSelected(event.target.files)}
        />
        <strong>לחץ להעלאת קבצים</strong>
        <small>אפשר להעלות כמה קבצים ביחד</small>
      </label>

      {documents.length === 0 ? (
        <p className="empty">עדיין לא הועלו מסמכים.</p>
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
              <button type="button" onClick={() => onRemoveDocument(doc.id)}>
                הסר
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
