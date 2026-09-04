export const ROUTES = {
  HOME: '/(tabs)',
  EVIDENCE: '/(tabs)/evidence',
  TIMELINE: '/(tabs)/timeline',
  REPORT: '/(tabs)/report',
  CASE_DETAIL: (id: string) => `/case/${id}`,
  EVIDENCE_DETAIL: (id: string) => `/evidence/${id}`,
} as const;

export type RootStackParamList = {
  '(tabs)': undefined;
  'case/[id]': { id: string };
  'evidence/[id]': { id: string };
};
