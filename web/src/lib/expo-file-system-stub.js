// web/src/lib/expo-file-system-stub.js
// Заглушка для expo-file-system

const FileSystem = {
  documentDirectory: typeof window !== 'undefined' ? '/' : '',
  cacheDirectory: typeof window !== 'undefined' ? '/' : '',
  bundleDirectory: typeof window !== 'undefined' ? '/' : '',
  
  getInfoAsync: async (uri) => {
    return {
      exists: false,
      uri: uri,
      size: 0,
      isDirectory: false,
    };
  },
  
  readAsStringAsync: async (uri) => {
    return '';
  },
  
  writeAsStringAsync: async (uri, contents) => {
    // No-op для веба
  },
  
  deleteAsync: async (uri) => {
    // No-op для веба
  },
  
  makeDirectoryAsync: async (uri) => {
    // No-op для веба
  },
  
  readDirectoryAsync: async (uri) => {
    return [];
  },
  
  copyAsync: async (options) => {
    // No-op для веба
  },
  
  moveAsync: async (options) => {
    // No-op для веба
  },
  
  downloadAsync: async (uri, fileUri) => {
    return { uri: fileUri };
  },
  
  uploadAsync: async (url, fileUri, options) => {
    return { body: '', status: 200, headers: {} };
  },
  
  createDownloadResumable: (uri, fileUri, options) => {
    return {
      downloadAsync: async () => ({ uri: fileUri }),
      pauseAsync: async () => {},
      resumeAsync: async () => ({ uri: fileUri }),
      cancelAsync: async () => {},
      savable: () => null,
    };
  },
  
  createUploadTask: (url, fileUri, options) => {
    return {
      uploadAsync: async () => ({ body: '', status: 200, headers: {} }),
      pauseAsync: async () => {},
      resumeAsync: async () => ({ body: '', status: 200, headers: {} }),
      cancelAsync: async () => {},
    };
  },
};

// Экспортируем как default и как named export
export default FileSystem;
export const File = FileSystem;

// Экспортируем все методы как named exports
export const getInfoAsync = FileSystem.getInfoAsync;
export const readAsStringAsync = FileSystem.readAsStringAsync;
export const writeAsStringAsync = FileSystem.writeAsStringAsync;
export const deleteAsync = FileSystem.deleteAsync;
export const makeDirectoryAsync = FileSystem.makeDirectoryAsync;
export const readDirectoryAsync = FileSystem.readDirectoryAsync;
export const copyAsync = FileSystem.copyAsync;
export const moveAsync = FileSystem.moveAsync;
export const downloadAsync = FileSystem.downloadAsync;
export const uploadAsync = FileSystem.uploadAsync;
export const createDownloadResumable = FileSystem.createDownloadResumable;
export const createUploadTask = FileSystem.createUploadTask;

