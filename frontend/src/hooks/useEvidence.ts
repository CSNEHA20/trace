import { useEffect } from 'react';
import { useEvidenceStore } from '../store/evidenceStore';
import { useCaseStore } from '../store/caseStore';

export function useEvidence() {
  const activeCase = useCaseStore((state) => state.activeCase);
  const evidenceStore = useEvidenceStore();

  useEffect(() => {
    if (activeCase) {
      evidenceStore.fetchEvidence(activeCase.id);
    }
  }, [activeCase?.id]);

  const filteredEvidence = evidenceStore.evidenceList.filter((item) => {
    const matchesType =
      evidenceStore.filterType === 'ALL' || item.type === evidenceStore.filterType;
    const matchesSearch =
      !evidenceStore.searchQuery ||
      item.title.toLowerCase().includes(evidenceStore.searchQuery.toLowerCase()) ||
      item.sha256Hash.toLowerCase().includes(evidenceStore.searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return {
    ...evidenceStore,
    filteredEvidence,
  };
}
