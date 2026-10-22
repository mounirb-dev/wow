import { InputFile } from "node-appwrite/file";
import { BUCKET_ID, adminStorage } from "./appwrite.js";

// Sube bytes al bucket. El SDK de Appwrite solo envía como archivo un `File` o un `InputFile`: un
// Buffer suelto se manda como un campo cualquiera y el servidor lo rechaza. `filename` aporta la
// extensión que valida el bucket (png, jpg, pdf…).
export const uploadFile = (fileId, bytes, filename) => adminStorage().createFile(BUCKET_ID, fileId, InputFile.fromBuffer(bytes, filename), []);

export const deleteFile = (fileId) => adminStorage().deleteFile(BUCKET_ID, fileId);
