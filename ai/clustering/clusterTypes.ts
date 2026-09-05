import { EventRecord } from '../../frontend/src/types';
import { RejectedClusterItem, RECONSTRUCTION_DISCLAIMER } from './eventTypes';

export { RECONSTRUCTION_DISCLAIMER };

export interface ClusterOperationResult {
  caseId: string;
  persisted: EventRecord[];
  rejected: RejectedClusterItem[];
  chunks: number;
  skippedReason?: 'NO_EXTRACTED_TEXT' | 'NO_EVIDENCE';
  reconstructionDisclaimer: string;
  chainNodeIds: string[];
}
