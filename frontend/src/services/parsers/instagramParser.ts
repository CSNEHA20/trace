import { IChatParser, ParsedDocument, ParsedMessage, ParserOptions } from '../../types/parser';
import * as Crypto from 'expo-crypto';

export class InstagramParser implements IChatParser {
  canParse(content: string, options?: ParserOptions): boolean {
    if (options?.fileName && options.fileName.toLowerCase().includes('instagram')) {
      return true;
    }
    try {
      const data = JSON.parse(content);
      // Instagram JSON usually has a "messages" array and "participants" array
      return data && typeof data === 'object' && Array.isArray(data.messages) && Array.isArray(data.participants);
    } catch {
      // Basic HTML heuristic
      if (content.includes('Message') && content.includes('div') && content.includes('class="_')) {
        return true;
      }
      return false;
    }
  }

  async parse(content: string, options?: ParserOptions): Promise<ParsedDocument> {
    try {
      const data = JSON.parse(content);
      return this.parseJson(data);
    } catch {
      return this.parseHtml(content);
    }
  }

  private parseJson(data: any): ParsedDocument {
    const messages: ParsedMessage[] = [];
    const participants = new Set<string>();

    if (!Array.isArray(data.messages)) {
      throw new Error("Invalid Instagram JSON: missing 'messages' array");
    }

    if (Array.isArray(data.participants)) {
      data.participants.forEach((p: any) => participants.add(p.name || p));
    }

    for (const msg of data.messages) {
      const sender = msg.sender_name || 'Unknown';
      participants.add(sender);

      let text = msg.content || '';
      
      const mediaReferences: string[] = [];
      if (msg.photos) msg.photos.forEach((p: any) => mediaReferences.push(p.uri));
      if (msg.videos) msg.videos.forEach((v: any) => mediaReferences.push(v.uri));
      if (msg.audio_files) msg.audio_files.forEach((a: any) => mediaReferences.push(a.uri));
      if (msg.files) msg.files.forEach((f: any) => mediaReferences.push(f.uri));

      // Decode unicode escapes in instagram json
      try {
         text = decodeURIComponent(escape(text));
      } catch {}

      messages.push({
        id: Crypto.randomUUID(),
        sender,
        text,
        timestamp: new Date(msg.timestamp_ms).toISOString(),
        mediaReferences
      });
    }

    return {
      format: 'instagram',
      messages: messages.reverse(), // Instagram JSON usually has newest first, we want chronological
      metadata: {
        participants: Array.from(participants),
        title: data.title || 'Instagram Chat'
      }
    };
  }

  private parseHtml(content: string): ParsedDocument {
    // Basic regex-based parser for Instagram's legacy HTML exports
    // Highly fragile, JSON is preferred
    const messages: ParsedMessage[] = [];
    const participants = new Set<string>();

    // Roughly extract blocks of div containing name, time, text
    // E.g., <div class="pam _3-95 _2pi0 _2lej uiBoxWhite noborder">...<div class="_3-96 _2pio _2lek _2lel">Sender Name</div><div class="_3-94 _2lem">Text</div><div class="_3-94 _2lem">Date</div>
    
    // Very simplified regex extraction.
    throw new Error("Instagram HTML parsing is not yet fully supported, please use JSON export.");
  }
}
