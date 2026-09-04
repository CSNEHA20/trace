import { HashChainRecord } from '../../frontend/src/types';

export interface IHashChainRepository {
  insertHashChain(hc: HashChainRecord): Promise<HashChainRecord>;
  getHashChainForEvidence(evidenceId: string): Promise<HashChainRecord[]>;
  getLatestHashChainNode(evidenceId: string): Promise<HashChainRecord | null>;
}
