import { databaseEngine } from '../../database/services/databaseEngine';
import { chainService } from '../../frontend/src/services/chainService';
import { hashService } from '../../frontend/src/services/hashService';
import { ActorRecord, EvidenceRecord, EventRecord } from '../../frontend/src/types';
import { actorIdentificationService, ActorIdentificationResult } from './actorIdentificationService';
import { timelineClusterer } from '../clustering/timelineClusterer';

export interface ActorPipelineResult {
  caseId: string;
  actors: ActorRecord[];
  actorIdentification: ActorIdentificationResult;
  events: EventRecord[];
  chainNodeIds: string[];
}

export interface ActorPipelineOptions {
  onProgress?: (progress: { stage: string; message: string }) => void;
  inferencer?: any;
}

export class ActorPipeline {
  async runCase(caseId: string, options: ActorPipelineOptions = {}): Promise<ActorPipelineResult> {
    options.onProgress?.({ stage: 'FETCHING_EVIDENCE', message: 'Fetching evidence for case...' });
    
    const evidence = await databaseEngine.getEvidenceForCase(caseId);
    if (evidence.length === 0) {
      throw new Error(`No evidence found for case ${caseId}`);
    }

    options.onProgress?.({ stage: 'IDENTIFYING_ACTORS', message: 'Identifying actors from evidence...' });
    
    const existingActors = await databaseEngine.getActorsForCase(caseId);
    const actorIdentification = await actorIdentificationService.identifyActors(
      caseId,
      evidence,
      {
        existingActors,
        evidence,
        inferencer: options.inferencer,
        onProgress: options.onProgress 
          ? (p) => options.onProgress!({ stage: p.stage, message: p.message })
          : undefined,
      }
    );

    options.onProgress?.({ stage: 'PERSISTING_ACTORS', message: 'Persisting actors to database...' });
    
    for (const actor of actorIdentification.actors) {
      await databaseEngine.insertActor(actor);
    }

    for (const match of actorIdentification.matches) {
      const actor = actorIdentification.actors.find(a => a.id === match.actor_id);
      if (actor) {
        for (const id of match.matched_identifiers) {
          await databaseEngine.addIdentifier(actor.id, id);
        }
      }
    }

    options.onProgress?.({ stage: 'CLUSTERING_EVENTS', message: 'Clustering events and linking actors...' });
    
    const clusterResult = await timelineClusterer.clusterCase(caseId, {
      inferencer: options.inferencer,
      onProgress: options.onProgress
        ? (p) => options.onProgress!({ stage: p.stage, message: p.message })
        : undefined,
    });

    options.onProgress?.({ stage: 'LINKING_ACTORS_TO_EVENTS', message: 'Linking actors to events...' });
    
    const eventsWithActors = await this.linkActorsToEvents(
      caseId,
      clusterResult.persisted,
      actorIdentification.actors,
      evidence
    );

    options.onProgress?.({ stage: 'COMPLETE', message: 'Actor identification pipeline complete.' });

    return {
      caseId,
      actors: actorIdentification.actors,
      actorIdentification,
      events: eventsWithActors,
      chainNodeIds: clusterResult.chainNodeIds,
    };
  }

  private async linkActorsToEvents(
    caseId: string,
    events: EventRecord[],
    actors: ActorRecord[],
    evidence: EvidenceRecord[]
  ): Promise<EventRecord[]> {
    const evidenceMap = new Map(evidence.map(e => [e.id, e]));
    const actorEvidenceMap = new Map<string, Set<string>>();

    for (const actor of actors) {
      const evidenceIds = new Set<string>();
      for (const id of actor.identifiers) {
        for (const eid of id.evidence_ids) {
          evidenceIds.add(eid);
        }
      }
      actorEvidenceMap.set(actor.id, evidenceIds);
    }

    const updatedEvents: EventRecord[] = [];

    for (const event of events) {
      const eventActorIds: string[] = [];
      const eventEvidenceIds = new Set(event.evidence_ids);

      for (const actor of actors) {
        const actorEvidences = actorEvidenceMap.get(actor.id);
        if (!actorEvidences) continue;

        const overlap = [...eventEvidenceIds].filter(eid => actorEvidences.has(eid));
        if (overlap.length > 0) {
          const confidence = this.calculateActorEventConfidence(actor, overlap, evidenceMap);
          if (confidence >= 0.5) {
            eventActorIds.push(actor.id);
          }
        }
      }

      if (eventActorIds.length > 0 || event.actor_ids.length === 0) {
        const updated = await databaseEngine.updateEvent(event.id, {
          actor_ids: [...new Set([...event.actor_ids, ...eventActorIds])],
        });
        if (updated) updatedEvents.push(updated);
      } else {
        updatedEvents.push(event);
      }
    }

    return updatedEvents;
  }

  private calculateActorEventConfidence(
    actor: ActorRecord,
    evidenceIds: string[],
    evidenceMap: Map<string, EvidenceRecord>
  ): number {
    let totalConfidence = 0;
    let count = 0;

    for (const eid of evidenceIds) {
      const evidence = evidenceMap.get(eid);
      if (!evidence) continue;

      for (const identifier of actor.identifiers) {
        if (identifier.evidence_ids.includes(eid)) {
          totalConfidence += identifier.confidence;
          count++;
        }
      }
    }

    return count > 0 ? totalConfidence / count : 0;
  }
}

export const actorPipeline = new ActorPipeline();