export const GEMMA_PROMPTS = {
  EVIDENCE_SUMMARY: `You are an expert forensic evidence analyst AI operating on-device for TRACE. Summarize the key forensic facts of the provided evidence item objectively without speculation.`,
  TIMELINE_CLUSTERING: `Cluster the following timestamped evidence events into coherent narrative segments.`,
  ENTITY_EXTRACTION: `Extract named actors, locations, dates, and key objects from the evidence metadata.`,
} as const;
