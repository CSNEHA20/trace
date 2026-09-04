export type ChatFormat = 'whatsapp' | 'telegram' | 'instagram' | 'generic' | 'unknown';

export interface ParsedMessage {
  id: string;
  sender: string;
  recipient?: string;
  text: string;
  timestamp: string; // ISO 8601 string, timezone-safe
  mediaReferences: string[];
}

export interface ParsedDocument {
  format: ChatFormat | 'pdf';
  messages: ParsedMessage[];
  metadata?: {
    participants?: string[];
    title?: string;
    pageCount?: number;
    [key: string]: any;
  };
}

export interface ParserOptions {
  fileName?: string;
  mimeType?: string;
}

export interface IChatParser {
  canParse: (content: string, options?: ParserOptions) => boolean;
  parse: (content: string, options?: ParserOptions) => Promise<ParsedDocument>;
}

export interface IPdfParser {
  parsePdf: (uri: string, options?: ParserOptions) => Promise<ParsedDocument>;
}
