// Migración 010_storage_bucket: Bucket de Storage "documents" para los archivos de carpetas e iconos.
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
export async function up({ storage, BUCKET_ID }) {
  try {
    await storage.getBucket(BUCKET_ID);
  } catch (error) {
    if (error.code !== 404) throw error;
    await storage.createBucket(BUCKET_ID, "Workspace files", [], true, true, 25 * 1024 * 1024, ["pdf", "png", "jpg", "jpeg", "webp", "txt", "csv", "doc", "docx", "xls", "xlsx"]);
  }
}
