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

jest.mock('@react-native-picker/picker', () => ({
  Picker: 'Picker',
  PickerItem: 'PickerItem',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const colors = { primary: '#000', background: '#fff', surface: '#fff', text: '#000', onSurface: '#000', disabled: '#888', placeholder: '#888', backdrop: '#000', notification: '#f00', error: '#f00' };
  return {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Surface: ({ children, ...props }: any) => React.createElement('View', props, children),
    Card: ({ children, ...props }: any) => React.createElement('View', props, children),
    CardContent: ({ children, ...props }: any) => React.createElement('View', props, children),
    Button: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, React.createElement('Text', null, children)),
    IconButton: ({ ...props }: any) => React.createElement('TouchableOpacity', props),
    Switch: ({ ...props }: any) => React.createElement('Switch', props),
    TextInput: ({ ...props }: any) => React.createElement('TextInput', props),
    ProgressBar: ({ ...props }: any) => React.createElement('View', props),
    ActivityIndicator: ({ ...props }: any) => React.createElement('ActivityIndicator', props),
    Avatar: ({ ...props }: any) => React.createElement('View', props),
    Badge: ({ ...props }: any) => React.createElement('View', props),
    Chip: ({ ...props }: any) => React.createElement('View', props),
    Divider: ({ ...props }: any) => React.createElement('View', props),
    List: {
      Item: ({ children, ...props }: any) => React.createElement('View', props, children),
      Accordion: ({ children, ...props }: any) => React.createElement('View', props, children),
    },
    Menu: ({ ...props }: any) => React.createElement('View', props),
    Modal: ({ ...props }: any) => React.createElement('View', props),
    Snackbar: () => null,
    useTheme: () => ({ colors }),
    MD3DarkTheme: { colors },
    MD3LightTheme: { colors },
    adaptNavigationTheme: () => ({}),
    DefaultTheme: { colors },
    DarkTheme: { colors },
  };
});