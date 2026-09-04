export class EntityExtractor {
  extractEntities(text: string): { actors: string[]; locations: string[] } {
    return {
      actors: ['Investigator SNEHA C'],
      locations: ['Zone 4 Perimeter'],
    };
  }
}

export const entityExtractor = new EntityExtractor();
