// Migración 016_document_parts: subida de archivos grandes (fotos, vídeos…) por partes.
//  - documents.size: bytes totales del archivo.
//  - documents.partIds: ids de Storage de cada parte, en orden (los documentos anteriores no la tienen
//    y siguen leyéndose por storageFileId).
//  - Bucket: sin lista de extensiones (cualquier tipo de archivo) para poder guardar fotos, vídeos y
//    el resto, y las partes (.bin). El tamaño máximo por archivo del bucket (25 MB) sigue valiendo: cada
//    parte pesa 4 MB.
// Idempotente donde es posible: comprueba si el recurso existe antes de crearlo.
export async function up({ db, DB, storage, BUCKET_ID, waitColumns }) {
  const ensure = async (key, create) => {
    try {
      await db.getColumn(DB, "documents", key);
    } catch (error) {
      if (error.code !== 404) throw error;
      await create();
    }
  };
  await ensure("size", () => db.createIntegerColumn(DB, "documents", "size", false, 0, 2 ** 40));
  await ensure("partIds", () => db.createStringColumn(DB, "documents", "partIds", 36, false, undefined, true));
  await waitColumns("documents");

  const bucket = await storage.getBucket(BUCKET_ID);
  if (bucket.allowedFileExtensions?.length) {
    await storage.updateBucket(BUCKET_ID, bucket.name, bucket.$permissions, bucket.fileSecurity, bucket.enabled, bucket.maximumFileSize, [], bucket.compression, bucket.encryption, bucket.antivirus, bucket.transformations, bucket.description, bucket.stripMetadata);
  }
}
