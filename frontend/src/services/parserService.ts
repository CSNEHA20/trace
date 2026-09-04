import { ParsedDocument, ParserOptions } from '../types/parser';
import { WhatsAppParser } from './parsers/whatsappParser';
import { TelegramParser } from './parsers/telegramParser';
import { InstagramParser } from './parsers/instagramParser';
import { GenericParser } from './parsers/genericParser';
import { PdfParser } from './parsers/pdfParser';

export class ParserService {
  private whatsappParser = new WhatsAppParser();
  private telegramParser = new TelegramParser();
  private instagramParser = new InstagramParser();
  private genericParser = new GenericParser();
  private pdfParser = new PdfParser();

  /**
   * Parse a chat export text/json file.
   */
  async parseChatExport(content: string, options?: ParserOptions): Promise<ParsedDocument> {
    if (!content) {
      throw new Error("Cannot parse empty content");
    }

    if (this.whatsappParser.canParse(content, options)) {
      try {
        return await this.whatsappParser.parse(content, options);
      } catch (e) {
        console.warn("Failed WhatsApp parse, falling back", e);
      }
    }

    if (this.telegramParser.canParse(content, options)) {
      try {
        return await this.telegramParser.parse(content, options);
      } catch (e) {
        console.warn("Failed Telegram parse, falling back", e);
      }
    }

    if (this.instagramParser.canParse(content, options)) {
      try {
        return await this.instagramParser.parse(content, options);
      } catch (e) {
        console.warn("Failed Instagram parse, falling back", e);
      }
    }

    // Fallback
    return await this.genericParser.parse(content, options);
  }

  /**
   * Parse a PDF file.
   */
  async parsePdfFile(uri: string, options?: ParserOptions): Promise<ParsedDocument> {
    if (!uri) {
      throw new Error("Cannot parse empty PDF uri");
    }
    return await this.pdfParser.parsePdf(uri, options);
  }
}

export const parserService = new ParserService();
