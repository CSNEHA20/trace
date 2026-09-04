export class TimelineClusterer {
  clusterEvents(events: Array<{ timestamp: number; title: string }>): Array<{ timeGroup: string; items: typeof events }> {
    return [
      {
        timeGroup: 'Primary Incident Window',
        items: events,
      },
    ];
  }
}

export const timelineClusterer = new TimelineClusterer();
