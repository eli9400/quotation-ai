export const allowedFileExtensions = new Set(['.pdf', '.doc', '.docx'])

export const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const uploadLimits = {
  maxFiles: 20,
}
