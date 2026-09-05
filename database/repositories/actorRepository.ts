import { ActorRecord, ActorIdentifier, ActorIdentifierType, ActorMatchResult, CrossEvidenceActorMatch } from '../../frontend/src/types';

export interface IActorRepository {
  insertActor(a: ActorRecord): Promise<ActorRecord>;
  getActorById(id: string): Promise<ActorRecord | null>;
  getActorsForCase(caseId: string): Promise<ActorRecord[]>;
  deleteActor(id: string): Promise<boolean>;
  updateActor(id: string, updates: Partial<ActorRecord>): Promise<ActorRecord | null>;
  addIdentifier(actorId: string, identifier: ActorIdentifier): Promise<ActorRecord | null>;
  findActorByIdentifier(caseId: string, type: ActorIdentifierType, value: string): Promise<ActorRecord | null>;
  findActorsByIdentifiers(caseId: string, identifiers: ActorIdentifier[]): Promise<ActorMatchResult[]>;
  mergeActors(primaryActorId: string, secondaryActorId: string): Promise<ActorRecord | null>;
  getActorsForEvidence(evidenceId: string): Promise<ActorRecord[]>;
  linkActorToEvidence(actorId: string, evidenceId: string): Promise<void>;
  unlinkActorFromEvidence(actorId: string, evidenceId: string): Promise<void>;
}
