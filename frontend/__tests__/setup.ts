jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock_documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ size: 102400 }),
}));

jest.mock('react-native-html-to-pdf', () => ({
  convert: jest.fn().mockResolvedValue({ filePath: 'file:///mock_documents/report.pdf' }),
}));