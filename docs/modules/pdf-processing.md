# PDF Processing

The TRACE application requires robust on-device extraction of PDF data. 

## Strategy

### 1. Text Layer Extraction
For standard digital PDFs, the application targets the embedded text layer. In a production environment, this is achieved using libraries such as `pdfjs-dist`. 
- **Method:** Traverse pages and extract text strings.
- **Result:** Pure text extraction with basic spatial understanding, concatenated into normalized messages.

### 2. Local OCR for Scanned PDFs
For scanned PDFs lacking a text layer, visual rendering and OCR is necessary.
- **Method:** Render PDF pages to images. Use a local OCR library (like a WASM build of `tesseract.js` or a React Native native module bindings).
- **Result:** Text extraction from pixels. 

> **Important Constraint:** For the current prototype phase in Expo, heavy WASM and native OCR bindings are stubbed to ensure broad compatibility and deterministic execution without ejecting or custom development builds.

## Extraction Flow

1. User selects a PDF document via `expo-document-picker`.
2. The file is copied to the secure sandbox.
3. `ParserService.parsePdfFile(uri)` is invoked.
4. The file is analyzed for a text layer.
5. If missing, local OCR is initialized.
6. Extracted content is transformed into a `ParsedDocument`.
7. The extracted content undergoes cryptographic hashing (via `TRANSCRIPTION_EXTRACT` or a generic `DOCUMENT_EXTRACT` operation) to maintain chain of custody.

## Future Enhancements
- Integration of custom dev clients to support `react-native-tesseract-ocr`.
- Page preservation: Storing page numbers alongside extracted blocks to maintain context.
