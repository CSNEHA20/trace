import { useNarrativeStore } from '../../src/store/narrativeStore';
import { databaseService } from '../../src/services/databaseService';
import { NarrativeRecord } from '../../src/types';

jest.mock('../../src/services/databaseService');

describe('useNarrativeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNarrativeStore.getState().clear();
  });

  it('initializes with empty state', () => {
    const state = useNarrativeStore.getState();
    expect(state.currentNarrative).toBeNull();
    expect(state.isGenerating).toBe(false);
    expect(state.generationProgress).toBeNull();
    expect(state.error).toBeNull();
  });

  it('sets current narrative', () => {
    const mockNarrative: NarrativeRecord = {
      id: 'narr-1',
      case_id: 'case-1',
      content: 'Test narrative content',
      generated_at: Date.now(),
      events_snapshot: JSON.stringify(['evt-1']),
      disclaimer: 'Test disclaimer',
      user_reviewed: false,
      user_edited: false,
    };

    useNarrativeStore.getState().setCurrentNarrative(mockNarrative);
    expect(useNarrativeStore.getState().currentNarrative).toEqual(mockNarrative);
  });

  it('sets generating state', () => {
    useNarrativeStore.getState().setGenerating(true);
    expect(useNarrativeStore.getState().isGenerating).toBe(true);

    useNarrativeStore.getState().setGenerating(false);
    expect(useNarrativeStore.getState().isGenerating).toBe(false);
  });

  it('sets progress', () => {
    const progress = { stage: 'INFERRING', completedChunks: 1, totalChunks: 3, message: 'Processing...' };
    useNarrativeStore.getState().setProgress(progress);
    expect(useNarrativeStore.getState().generationProgress).toEqual(progress);
  });

  it('sets error', () => {
    useNarrativeStore.getState().setError('Test error');
    expect(useNarrativeStore.getState().error).toBe('Test error');

    useNarrativeStore.getState().setError(null);
    expect(useNarrativeStore.getState().error).toBeNull();
  });

  it('loads latest narrative from database', async () => {
    const mockNarrative: NarrativeRecord = {
      id: 'narr-1',
      case_id: 'case-1',
      content: 'Loaded narrative',
      generated_at: Date.now(),
      events_snapshot: JSON.stringify(['evt-1']),
      disclaimer: 'Disclaimer',
      user_reviewed: false,
      user_edited: false,
    };

    (databaseService.getLatestNarrativeForCase as jest.Mock).mockResolvedValue(mockNarrative);

    await useNarrativeStore.getState().loadLatestNarrative('case-1');

    expect(databaseService.getLatestNarrativeForCase).toHaveBeenCalledWith('case-1');
    expect(useNarrativeStore.getState().currentNarrative).toEqual(mockNarrative);
  });

  it('handles load error', async () => {
    (databaseService.getLatestNarrativeForCase as jest.Mock).mockRejectedValue(new Error('DB error'));

    await useNarrativeStore.getState().loadLatestNarrative('case-1');

    expect(useNarrativeStore.getState().error).toBe('DB error');
    expect(useNarrativeStore.getState().currentNarrative).toBeNull();
  });

  it('clears all state', () => {
    useNarrativeStore.getState().setCurrentNarrative({
      id: 'narr-1',
      case_id: 'case-1',
      content: 'Test',
      generated_at: Date.now(),
      events_snapshot: '[]',
      disclaimer: 'D',
      user_reviewed: false,
      user_edited: false,
    });
    useNarrativeStore.getState().setGenerating(true);
    useNarrativeStore.getState().setProgress({ stage: 'INFERRING', completedChunks: 1, totalChunks: 2, message: '...' });
    useNarrativeStore.getState().setError('Error');

    useNarrativeStore.getState().clear();

    expect(useNarrativeStore.getState().currentNarrative).toBeNull();
    expect(useNarrativeStore.getState().isGenerating).toBe(false);
    expect(useNarrativeStore.getState().generationProgress).toBeNull();
    expect(useNarrativeStore.getState().error).toBeNull();
  });
});