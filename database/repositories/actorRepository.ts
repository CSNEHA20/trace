import { ActorRecord } from '../../frontend/src/types';

export interface IActorRepository {
  insertActor(a: ActorRecord): Promise<ActorRecord>;
  getActorById(id: string): Promise<ActorRecord | null>;
  getActorsForCase(caseId: string): Promise<ActorRecord[]>;
  deleteActor(id: string): Promise<boolean>;
}
