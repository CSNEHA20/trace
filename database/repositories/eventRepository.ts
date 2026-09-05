import { EventRecord } from '../../frontend/src/types';

export interface IEventRepository {
  insertEvent(ev: EventRecord): Promise<EventRecord>;
  getEventById(id: string): Promise<EventRecord | null>;
  getEventsForCase(caseId: string): Promise<EventRecord[]>;
  updateEvent(id: string, updates: Partial<EventRecord>): Promise<EventRecord | null>;
  deleteEvent(id: string): Promise<boolean>;
}
