import { useEffect, useState } from 'react';
import { databaseService } from '../services/databaseService';
import { logger } from '../utils/logger';

export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    databaseService
      .initialize()
      .then(() => setIsReady(true))
      .catch((err) => {
        logger.error('Failed to initialize database hook', err);
        setError((err as Error).message);
      });
  }, []);

  return { isReady, error };
}
