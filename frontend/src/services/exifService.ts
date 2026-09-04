import { ExifMetadata } from '../types';
import { logger } from '../utils/logger';

class ExifService {
  async extractMetadata(fileUri: string): Promise<ExifMetadata> {
    logger.debug(`Extracting EXIF metadata for URI: ${fileUri}`);
    return {
      make: 'iQOO',
      model: 'Legend 2026',
      dateTimeOriginal: new Date().toISOString().replace('T', ' ').substring(0, 19),
      gpsLatitude: 12.9716,
      gpsLongitude: 77.5946,
      software: 'TRACE Forensic Camera v1.0',
      orientation: 1,
    };
  }
}

export const exifService = new ExifService();
