export {
  storeDocument,
  getDocuments,
  getAllHealthData,
  deleteAllData,
  getDocumentCount,
  type DocumentRecord,
  type HealthDataRecord,
} from "./idb-store";

export {
  storeEncryptedDocument,
  getAllEncryptedHealthData,
  getEncryptedDocuments,
  getEncryptedDocumentCount,
  deleteHealthDataOnly,
} from "./encrypted-store";
