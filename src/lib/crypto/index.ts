export {
  generateKey,
  deriveKeyFromPassphrase,
  encrypt,
  decrypt,
  exportKey,
  importKey,
  type EncryptedData,
} from "./encryption";

export {
  initializeVault,
  unlockVault,
  changePassphrase,
  isVaultInitialized,
  lockVault,
  getMasterKey,
} from "./key-manager";
