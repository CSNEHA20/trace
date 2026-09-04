# Chat Parsers

The TRACE application includes deterministic local chat parsers designed to process various chat export formats strictly on-device without relying on cloud APIs.

## Supported Formats

### WhatsApp
- **Format:** TXT
- **Detection:** Heuristic matching of regex patterns `[DD/MM/YYYY, HH:MM:SS] Name: Message` (iOS) or `DD/MM/YYYY, HH:MM - Name: Message` (Android).
- **Features:** Supports multiline messages and `<attached: ...>` or `<Media omitted>` media references.

### Telegram
- **Format:** JSON
- **Detection:** Checks for the presence of a JSON object containing a `messages` array.
- **Features:** Extracts sender (`from`), `text` (handles string and array variations), and media objects (`photo`, `file`).

### Instagram
- **Format:** JSON (preferred) / HTML
- **Detection:** Checks for JSON with `messages` and `participants`. HTML fallback is heuristically matched.
- **Features:** Reverses order (Instagram exports newest first) and decodes unicode-escaped characters.

### Generic
- **Format:** TXT, CSV, or unknown
- **Detection:** Used as a fallback when no specific format matches.
- **Features:** Employs loose regex to match `[Date] Name: Message` patterns. Falls back to generating a generic timestamp and "Unknown" sender for unstructured lines.

## Architecture

Parsers implement the `IChatParser` interface:

```typescript
export interface IChatParser {
  canParse: (content: string, options?: ParserOptions) => boolean;
  parse: (content: string, options?: ParserOptions) => Promise<ParsedDocument>;
}
```

The `ParserService` evaluates `canParse` across the available parsers and routes the content appropriately. All parsed output is normalized into a `ParsedDocument` structure, maintaining consistent timezone-safe ISO 8601 timestamps and unique message UUIDs.

## Malformed Input Handling
Parsers use try-catch blocks and defensive property checking. If a message is malformed, the generic parser attempts to absorb it, assigning default values (e.g., current timestamp, "Unknown" sender) rather than throwing a fatal error.
