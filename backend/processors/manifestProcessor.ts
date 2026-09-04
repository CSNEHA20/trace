export class ManifestProcessor {
  processManifest(jsonContent: string): Record<string, unknown> {
    try {
      return JSON.parse(jsonContent);
    } catch {
      throw new Error('Invalid TRACE manifest JSON format');
    }
  }
}

export const manifestProcessor = new ManifestProcessor();
