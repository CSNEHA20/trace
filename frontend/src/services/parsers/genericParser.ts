import { IChatParser, ParsedDocument, ParsedMessage, ParserOptions } from '../../types/parser';
import * as Crypto from 'expo-crypto';

export class GenericParser implements IChatParser {
  canParse(content: string, options?: ParserOptions): boolean {
    return true; // Fallback parser
  }

  async parse(content: string, options?: ParserOptions): Promise<ParsedDocument> {
    const lines = content.split('\n');
    const messages: ParsedMessage[] = [];
    const participants = new Set<string>();
    
    let currentMessage: ParsedMessage | null = null;

    // Heuristics
    const bracketRegex = /^\[(.*?)\]\s*([^:]+):\s*(.*)$/;
    const hyphenRegex = /^(.*?)\s+-\s+([^:]+):\s*(.*)$/;
    const simpleRegex = /^([^:]+):\s*(.*)$/;

    for (const line of lines) {
      if (!line.trim()) continue;

      let dateStr, sender, text;
      let match = line.match(bracketRegex);
      if (match) {
        dateStr = match[1]; sender = match[2]; text = match[3];
      } else {
        match = line.match(hyphenRegex);
        if (match) {
          dateStr = match[1]; sender = match[2]; text = match[3];
        } else {
          match = line.match(simpleRegex);
          if (match) {
            sender = match[1]; text = match[2];
          }
        }
      }

      if (sender && sender.length < 30) {
        if (currentMessage) {
          messages.push(currentMessage);
        }
        
        participants.add(sender);

        currentMessage = {
          id: Crypto.randomUUID(),
          sender: sender.trim(),
          text: text.trim(),
          timestamp: this.normalizeDate(dateStr),
          mediaReferences: []
        };
      } else if (currentMessage) {
        currentMessage.text += '\n' + line.trim();
      } else {
        // Line without a clear sender/format. Just treat as a generic system/unknown message
        messages.push({
          id: Crypto.randomUUID(),
          sender: 'Unknown',
          text: line.trim(),
          timestamp: new Date().toISOString(),
          mediaReferences: []
        });
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    return {
      format: 'generic',
      messages,
      metadata: {
        participants: Array.from(participants),
      }
    };
  }

  private normalizeDate(dateStr?: string): string {
    if (!dateStr) return new Date().toISOString();
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    } catch {}
    return new Date().toISOString();
  }
}
