import { create } from 'zustand';

interface UiState {
  isCaptureModalOpen: boolean;
  isReportGenerating: boolean;
  activeTab: string;
  toastMessage: string | null;
  setCaptureModalOpen: (open: boolean) => void;
  setReportGenerating: (generating: boolean) => void;
  setActiveTab: (tab: string) => void;
  showToast: (msg: string) => void;
  hideToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCaptureModalOpen: false,
  isReportGenerating: false,
  activeTab: 'home',
  toastMessage: null,
  setCaptureModalOpen: (open) => set({ isCaptureModalOpen: open }),
  setReportGenerating: (generating) => set({ isReportGenerating: generating }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  showToast: (msg) => set({ toastMessage: msg }),
  hideToast: () => set({ toastMessage: null }),
}));
