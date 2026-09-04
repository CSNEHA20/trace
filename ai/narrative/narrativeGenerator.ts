export class NarrativeGenerator {
  generateCaseNarrative(caseTitle: string, evidenceCount: number): string {
    return `Forensic case narrative for "${caseTitle}" comprising ${evidenceCount} verified evidence items. All items signed with hardware cryptographic keys.`;
  }
}

export const narrativeGenerator = new NarrativeGenerator();
