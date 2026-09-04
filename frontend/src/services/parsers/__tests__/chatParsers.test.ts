import { WhatsAppParser } from '../whatsappParser';
import { TelegramParser } from '../telegramParser';
import { InstagramParser } from '../instagramParser';
import { GenericParser } from '../genericParser';
import { ParserService } from '../../parserService';

describe('Chat Parsers', () => {
  const parserService = new ParserService();

  describe('WhatsAppParser', () => {
    it('should parse iOS WhatsApp export', async () => {
      const content = `[14/05/2021, 14:24:34] John Doe: Hello world!
[14/05/2021, 14:25:00] Jane Smith: Hi John
<attached: image.jpg>`;
      
      const parser = new WhatsAppParser();
      expect(parser.canParse(content)).toBe(true);
      
      const result = await parser.parse(content);
      expect(result.format).toBe('whatsapp');
      expect(result.messages.length).toBe(2);
      expect(result.messages[0].sender).toBe('John Doe');
      expect(result.messages[0].text).toBe('Hello world!');
      expect(result.messages[1].mediaReferences).toContain('image.jpg');
    });

    it('should parse Android WhatsApp export', async () => {
      const content = `14/05/2021, 14:24 - John Doe: Hello world!
14/05/2021, 14:25 - Jane Smith: Hi John
<Media omitted>`;
      
      const parser = new WhatsAppParser();
      expect(parser.canParse(content)).toBe(true);
      
      const result = await parser.parse(content);
      expect(result.format).toBe('whatsapp');
      expect(result.messages.length).toBe(2);
      expect(result.messages[0].sender).toBe('John Doe');
      expect(result.messages[1].mediaReferences).toContain('omitted_media');
    });
  });

  describe('TelegramParser', () => {
    it('should parse Telegram JSON export', async () => {
      const content = JSON.stringify({
        name: "Test Chat",
        type: "personal_chat",
        id: 12345,
        messages: [
          {
            id: 1,
            type: "message",
            date: "2021-05-14T14:24:34",
            from: "John Doe",
            text: "Hello world!"
          },
          {
            id: 2,
            type: "message",
            date: "2021-05-14T14:25:00",
            from: "Jane Smith",
            text: [
              "Hi ",
              { type: "mention", text: "@johndoe" }
            ],
            photo: "photos/photo_1.jpg"
          }
        ]
      });

      const parser = new TelegramParser();
      expect(parser.canParse(content)).toBe(true);
      
      const result = await parser.parse(content);
      expect(result.format).toBe('telegram');
      expect(result.messages.length).toBe(2);
      expect(result.messages[0].sender).toBe('John Doe');
      expect(result.messages[1].text).toBe('Hi @johndoe');
      expect(result.messages[1].mediaReferences).toContain('photos/photo_1.jpg');
    });

    it('should handle malformed JSON', async () => {
      const parser = new TelegramParser();
      expect(parser.canParse('invalid json')).toBe(false);
    });
  });

  describe('InstagramParser', () => {
    it('should parse Instagram JSON export', async () => {
      const content = JSON.stringify({
        participants: [{ name: "John Doe" }, { name: "Jane Smith" }],
        messages: [
          {
            sender_name: "Jane Smith",
            timestamp_ms: 1621002300000,
            content: "Hi John",
            photos: [{ uri: "messages/inbox/johndoe/photos/1.jpg" }]
          },
          {
            sender_name: "John Doe",
            timestamp_ms: 1621002274000,
            content: "Hello world!"
          }
        ],
        title: "Jane Smith",
        is_still_participant: true,
        thread_type: "Regular"
      });

      const parser = new InstagramParser();
      expect(parser.canParse(content)).toBe(true);
      
      const result = await parser.parse(content);
      expect(result.format).toBe('instagram');
      expect(result.messages.length).toBe(2);
      // Ensure reverse order (chronological)
      expect(result.messages[0].sender).toBe('John Doe');
      expect(result.messages[1].sender).toBe('Jane Smith');
      expect(result.messages[1].mediaReferences).toContain('messages/inbox/johndoe/photos/1.jpg');
    });
  });

  describe('GenericParser', () => {
    it('should parse generic log format', async () => {
      const content = `User1: Hello
User2: Hi there
[2021-01-01] User1: Happy new year
System message without sender`;

      const parser = new GenericParser();
      expect(parser.canParse(content)).toBe(true);
      
      const result = await parser.parse(content);
      expect(result.format).toBe('generic');
      expect(result.messages.length).toBe(3);
      expect(result.messages[0].sender).toBe('User1');
      expect(result.messages[2].sender).toBe('User1');
      expect(result.messages[2].text).toBe('Happy new year\nSystem message without sender');
    });
  });

  describe('ParserService (Router)', () => {
    it('should route to the correct parser', async () => {
      const content = `[14/05/2021, 14:24:34] John: WhatsApp match`;
      const result = await parserService.parseChatExport(content);
      expect(result.format).toBe('whatsapp');
    });

    it('should route unknown format to generic parser', async () => {
      const content = `Bob: Just some text`;
      const result = await parserService.parseChatExport(content);
      expect(result.format).toBe('generic');
    });

    it('should route empty export to generic parser and handle it gracefully', async () => {
      const content = `   \n  \n`;
      const result = await parserService.parseChatExport(content);
      expect(result.format).toBe('generic');
      expect(result.messages.length).toBe(0);
    });
  });
});
