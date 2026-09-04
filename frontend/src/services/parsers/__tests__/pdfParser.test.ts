import { PdfParser } from '../pdfParser';
import { ParserService } from '../../parserService';

describe('PDF Parser', () => {
  const parserService = new ParserService();

  it('should parse a mock PDF file successfully', async () => {
    const parser = new PdfParser();
    const result = await parser.parsePdf('file://fake/path/document.pdf', { fileName: 'document.pdf' });
    
    expect(result.format).toBe('pdf');
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].text).toContain('[PDF Extracted Text from document.pdf]');
  });

  it('ParserService should route PDF parsing correctly', async () => {
    const result = await parserService.parsePdfFile('file://fake/path/doc.pdf', { fileName: 'doc.pdf' });
    expect(result.format).toBe('pdf');
  });

  it('ParserService should throw if URI is empty', async () => {
    await expect(parserService.parsePdfFile('')).rejects.toThrow("Cannot parse empty PDF uri");
  });
});
