declare module 'react-native' {
  export * from 'react-native/types';
}

declare module 'react-native-html-to-pdf' {
  export interface Options {
    html: string;
    fileName?: string;
    directory?: string;
    base64?: boolean;
    width?: number;
    height?: number;
    padding?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    bgColor?: string;
    fonts?: Record<string, string>;
    fontFaces?: Array<{ fontFamily: string; fontSrc: string; fontWeight?: string; fontStyle?: string }>;
  }
  
  export interface Result {
    filePath: string;
    base64?: string;
  }
  
  export function convert(options: Options): Promise<Result>;
  export default { convert };
}

declare module 'expo-print' {
  export interface PrintToFileOptions {
    html: string;
    base64?: boolean;
    width?: number;
    height?: number;
    margins?: { left: number; top: number; right: number; bottom: number };
  }
  
  export interface PrintToFileResult {
    uri: string;
    numberOfPages: number;
  }
  
  export function printToFileAsync(options: PrintToFileOptions): Promise<PrintToFileResult>;
  export function printAsync(options: PrintToFileOptions): Promise<void>;
}

declare module '@react-native-picker/picker' {
  import * as React from 'react';
  import { ViewStyle, TextStyle, StyleProp } from 'react-native';
  
  export interface PickerProps {
    selectedValue?: any;
    onValueChange?: (itemValue: any, itemIndex: number) => void;
    style?: StyleProp<ViewStyle>;
    itemStyle?: StyleProp<TextStyle>;
    mode?: 'dialog' | 'dropdown';
    enabled?: boolean;
    children?: React.ReactNode;
  }
  
  export interface PickerItemProps {
    label: string;
    value: any;
    color?: string;
    testID?: string;
  }
  
  export const Picker: React.FC<PickerProps>;
  export const PickerItem: React.FC<PickerItemProps>;
}

declare module 'expo-sharing' {
  export interface SharingOptions {
    mimeType?: string;
    dialogTitle?: string;
    UTI?: string;
  }
  
  export function isAvailableAsync(): Promise<boolean>;
  export function shareAsync(url: string, options?: SharingOptions): Promise<void>;
}

interface FileInfo {
  exists: boolean;
  isDirectory: boolean;
  uri: string;
  size?: number;
  md5?: string;
}

declare module 'expo-file-system' {
  export const documentDirectory: string;
  export const cacheDirectory: string;
  
  export interface FileInfo {
    exists: boolean;
    isDirectory: boolean;
    uri: string;
    size?: number;
    md5?: string;
  }
  
  export function getInfoAsync(path: string, options?: { md5: boolean }): Promise<FileInfo>;
  export function readAsStringAsync(path: string, options?: { encoding: 'utf8' | 'base64' }): Promise<string>;
  export function writeAsStringAsync(path: string, contents: string, options?: { encoding: 'utf8' | 'base64' }): Promise<void>;
  export function deleteAsync(path: string, options?: { idempotent: boolean }): Promise<void>;
  export function moveAsync(options: { from: string; to: string }): Promise<void>;
  export function copyAsync(options: { from: string; to: string }): Promise<void>;
  export function makeDirectoryAsync(path: string, options?: { intermediates: boolean }): Promise<void>;
  export function readDirectoryAsync(path: string): Promise<string[]>;
  export function downloadAsync(uri: string, fileUri: string, options?: any): Promise<FileInfo>;
  export function createDownloadResumable(uri: string, fileUri: string, options?: any, callback?: (downloadProgress: any) => void): any;
}