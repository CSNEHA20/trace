import { EventRecord } from '../../frontend/src/types';

export interface IEventRepository {
  insertEvent(ev: EventRecord): Promise<EventRecord>;
  getEventById(id: string): Promise<EventRecord | null>;
  getEventsForCase(caseId: string): Promise<EventRecord[]>;
  deleteEvent(id: string): Promise<boolean>;
}
