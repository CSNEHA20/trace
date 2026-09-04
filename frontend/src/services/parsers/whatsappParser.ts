import { IChatParser, ParsedDocument, ParsedMessage, ParserOptions } from '../../types/parser';
import * as Crypto from 'expo-crypto';

export class WhatsAppParser implements IChatParser {
  // Matches iOS: [14/05/2021, 14:24:34] Sender Name: Message
  // Matches Android: 14/05/2021, 14:24 - Sender Name: Message
  private iosRegex = /^\[(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}[, ]+\d{1,2}:\d{2}:\d{2}(?: [APM]{2})?)\] ([^:]+): ([\s\S]*)$/;
  private androidRegex = /^(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}[, ]+\d{1,2}:\d{2}(?: [APM]{2})?) - ([^:]+): ([\s\S]*)$/;
  
  // Media reference regex (e.g. <attached: image.jpg> or <Media omitted>)
  private mediaRegex = /<attached: ([^>]+)>|<Media omitted>|image omitted|video omitted|audio omitted/i;

  canParse(content: string, options?: ParserOptions): boolean {
    if (options?.fileName && options.fileName.toLowerCase().includes('whatsapp')) {
      return true;
    }
    // Check first few lines for known pattern
    const lines = content.split('\n').slice(0, 10);
    return lines.some(line => this.iosRegex.test(line) || this.androidRegex.test(line));
  }

  async parse(content: string, options?: ParserOptions): Promise<ParsedDocument> {
    const lines = content.split('\n');
    const messages: ParsedMessage[] = [];
    const participants = new Set<string>();
    
    let currentMessage: ParsedMessage | null = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      let match = line.match(this.iosRegex) || line.match(this.androidRegex);

      if (match) {
        // Save previous message if it exists
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const dateStr = match[1];
        const sender = match[2].trim();
        const text = match[3].trim();
        
        participants.add(sender);

        const mediaReferences: string[] = [];
        const mediaMatch = text.match(this.mediaRegex);
        if (mediaMatch) {
          if (mediaMatch[1]) {
            mediaReferences.push(mediaMatch[1]);
          } else {
            mediaReferences.push('omitted_media');
          }
        }

        currentMessage = {
          id: Crypto.randomUUID(),
          sender,
          text,
          timestamp: this.normalizeDate(dateStr),
          mediaReferences
        };
      } else if (currentMessage) {
        // Multiline message, append to current message text
        currentMessage.text += '\n' + line.trim();
        
        // Re-check for media in the appended line
        const mediaMatch = line.match(this.mediaRegex);
        if (mediaMatch) {
          if (mediaMatch[1]) {
            currentMessage.mediaReferences.push(mediaMatch[1]);
          } else {
            currentMessage.mediaReferences.push('omitted_media');
          }
        }
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    return {
      format: 'whatsapp',
      messages,
      metadata: {
        participants: Array.from(participants),
      }
    };
  }

  private normalizeDate(dateStr: string): string {
    // Basic heuristic to convert whatsapp date string to ISO
    // Note: In a robust app, we'd use date-fns or similar, but sticking to deterministic JS
    // Replace dots with slashes
    dateStr = dateStr.replace(/\./g, '/').replace(/\[/g, '').replace(/\]/g, '').trim();
    
    // Very basic parsing attempt. Will fall back to local date or raw string if parsing fails
    try {
      // 14/05/2021, 14:24 -> this is typically DD/MM/YYYY
      const parts = dateStr.split(/[, -]+/);
      if (parts.length >= 2) {
        let dPart = parts[0];
        let tPart = parts[1];
        if (dPart.includes('/')) {
          const dSplit = dPart.split('/');
          if (dSplit.length === 3) {
            // Assume DD/MM/YY or DD/MM/YYYY
            let year = dSplit[2];
            if (year.length === 2) year = '20' + year;
            const dateObj = new Date(`${year}-${dSplit[1]}-${dSplit[0]}T${tPart}:00`);
            if (!isNaN(dateObj.getTime())) {
              return dateObj.toISOString();
            }
          }
        }
      }
      // Fallback
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString(); // Fallback to current time if completely malformed
    }
  }
}
