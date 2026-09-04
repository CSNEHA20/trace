export class ExifParser {
  parseExifBuffer(buffer: Buffer): Record<string, unknown> {
    return {
      parsed: true,
      length: buffer.length,
    };
  }
}

export const exifParser = new ExifParser();
