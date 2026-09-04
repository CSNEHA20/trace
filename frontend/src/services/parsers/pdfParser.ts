import { IPdfParser, ParsedDocument, ParsedMessage, ParserOptions } from '../../types/parser';
import * as Crypto from 'expo-crypto';

export class PdfParser implements IPdfParser {
  async parsePdf(uri: string, options?: ParserOptions): Promise<ParsedDocument> {
    // In a full production environment, this would use pdfjs-dist for text extraction
    // and tesseract.js or native OCR for scanned pages.
    // For this implementation, we stub the actual heavy WASM/Native processing 
    // to maintain deterministic JS execution within Expo's boundaries.

    console.warn("PDF parsing is currently a mock implementation. Requires native OCR/PDF bindings.");
    
    const messages: ParsedMessage[] = [];
    
    // Mock extraction
    messages.push({
      id: Crypto.randomUUID(),
      sender: 'System',
      text: `[PDF Extracted Text from ${options?.fileName || 'document.pdf'}]`,
      timestamp: new Date().toISOString(),
      mediaReferences: []
    });

    return {
      format: 'pdf',
      messages,
      metadata: {
        title: options?.fileName || 'PDF Document',
        pageCount: 1, // Mock
        isScanned: false // Mock
      }
    };
  }
}
