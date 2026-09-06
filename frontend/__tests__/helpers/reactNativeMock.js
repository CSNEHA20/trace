/**
 * Mock for react-native to avoid parsing issues in Jest
 */

const ReactNativeMock = {
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles) => styles,
    compose: (...styles) => styles,
    flatten: (style) => style,
    hairlineWidth: 1,
  },
  TouchableOpacity: 'TouchableOpacity',
  TouchableHighlight: 'TouchableHighlight',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  TextInput: 'TextInput',
  Switch: 'Switch',
  Alert: {
    alert: jest.fn(),
  },
  ActivityIndicator: 'ActivityIndicator',
  Picker: 'Picker',
  Modal: 'Modal',
  Image: 'Image',
  ImageBackground: 'ImageBackground',
  Platform: {
    OS: 'ios',
    Version: '15.0',
    select: (obj) => obj.ios || obj.default,
    constants: {
      reactNativeVersion: { major: 0, minor: 74, patch: 5 },
    },
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  NativeModules: {},
  DeviceEventEmitter: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    emit: jest.fn(),
  },
  AppRegistry: {
    registerComponent: jest.fn(),
  },
  BackHandler: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
  },
  PermissionsAndroid: {
    request: jest.fn(),
    check: jest.fn(),
  },
  StatusBar: {
    setBarStyle: jest.fn(),
    setBackgroundColor: jest.fn(),
  },
  Animated: {
    Value: class {
      constructor(value) {
        this._value = value;
      }
      setValue(value) {
        this._value = value;
      }
      interpolate() {
        return this;
      }
    },
    timing: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    spring: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    loop: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    sequence: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    parallel: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    delay: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    event: () => ({}),
    createAnimatedComponent: (comp) => comp,
  },
  Easing: {
    linear: () => {},
    ease: () => {},
    quad: () => {},
    cubic: () => {},
    poly: () => {},
    sin: () => {},
    circle: () => {},
    exp: () => {},
    elastic: () => {},
    bounce: () => {},
    back: () => {},
    bezier: () => {},
    in: () => {},
    out: () => {},
    inOut: () => {},
    outIn: () => {},
  },
  Keyboard: {
    dismiss: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  AccessibilityInfo: {
    fetch: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  PixelRatio: {
    get: () => 2,
  },
  SafeAreaView: 'SafeAreaView',
  SafeAreaContext: {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  },
  RefreshControl: 'RefreshControl',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  VirtualizedList: 'VirtualizedList',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Share: {
    share: jest.fn(),
  },
  Vibration: {
    vibrate: jest.fn(),
  },
};

module.exports = ReactNativeMock;