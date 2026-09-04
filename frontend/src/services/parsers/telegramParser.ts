import { IChatParser, ParsedDocument, ParsedMessage, ParserOptions } from '../../types/parser';
import * as Crypto from 'expo-crypto';

export class TelegramParser implements IChatParser {
  canParse(content: string, options?: ParserOptions): boolean {
    if (options?.fileName && options.fileName.toLowerCase().includes('telegram')) {
      return true;
    }
    try {
      const data = JSON.parse(content);
      return data && typeof data === 'object' && Array.isArray(data.messages);
    } catch {
      return false;
    }
  }

  async parse(content: string, options?: ParserOptions): Promise<ParsedDocument> {
    try {
      const data = JSON.parse(content);
      const messages: ParsedMessage[] = [];
      const participants = new Set<string>();

      if (!Array.isArray(data.messages)) {
        throw new Error("Invalid Telegram JSON: missing 'messages' array");
      }

      for (const msg of data.messages) {
        // Telegram JSON format: msg.type === "message", msg.text (can be array or string), msg.date, msg.from
        if (msg.type !== 'message') continue;

        let text = '';
        if (typeof msg.text === 'string') {
          text = msg.text;
        } else if (Array.isArray(msg.text)) {
          text = msg.text.map((t: any) => typeof t === 'string' ? t : t.text).join('');
        }

        const sender = msg.from || 'Unknown';
        participants.add(sender);

        const mediaReferences: string[] = [];
        if (msg.photo) mediaReferences.push(msg.photo);
        if (msg.file) mediaReferences.push(msg.file);
        if (msg.media_type) mediaReferences.push(msg.media_type);

        messages.push({
          id: msg.id ? String(msg.id) : Crypto.randomUUID(),
          sender,
          text,
          timestamp: new Date(msg.date).toISOString(),
          mediaReferences
        });
      }

      return {
        format: 'telegram',
        messages,
        metadata: {
          participants: Array.from(participants),
          title: data.name || 'Telegram Chat'
        }
      };
    } catch (e) {
      throw new Error(`Failed to parse Telegram export: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
}
