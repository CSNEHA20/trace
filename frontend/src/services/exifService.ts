import ExifReader from 'exifreader';
import { sandboxService } from './sandboxService';
import { ExifMetadata } from '../types';
import { logger } from '../utils/logger';

class ExifService {
  async extractMetadata(fileUri: string): Promise<ExifMetadata | null> {
    try {
      const base64 = await sandboxService.readSandboxFileBase64(fileUri);
      if (!base64 || typeof base64 !== 'string') return null;

      let buffer: ArrayBuffer;
      try {
        if (typeof Buffer !== 'undefined') {
          const buf = Buffer.from(base64, 'base64');
          buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        } else {
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          buffer = bytes.buffer;
        }
      } catch {
        return null;
      }

      let tags: Record<string, any>;
      try {
        tags = ExifReader.load(buffer, { expanded: true });
      } catch (err) {
        // Not an image with EXIF headers or unsupported header
        return null;
      }

      if (!tags || typeof tags !== 'object') {
        return null;
      }

      const make = tags['Make']?.description;
      const model = tags['Model']?.description;
      const dateTimeOriginal = tags['DateTimeOriginal']?.description || tags['DateTime']?.description;
      const software = tags['Software']?.description;
      const orientation = tags['Orientation']?.value ? Number(tags['Orientation'].value) : undefined;

      let gpsLatitude: number | undefined;
      let gpsLongitude: number | undefined;
      let gpsAltitude: number | undefined;

      if (tags['GPSLatitude']) {
        const lat = tags['GPSLatitude'].description;
        const parsed = typeof lat === 'number' ? lat : parseFloat(String(lat));
        if (!isNaN(parsed)) {
          gpsLatitude = tags['GPSLatitudeRef']?.value?.[0] === 'S' ? -parsed : parsed;
        }
      }

      if (tags['GPSLongitude']) {
        const lon = tags['GPSLongitude'].description;
        const parsed = typeof lon === 'number' ? lon : parseFloat(String(lon));
        if (!isNaN(parsed)) {
          gpsLongitude = tags['GPSLongitudeRef']?.value?.[0] === 'W' ? -parsed : parsed;
        }
      }

      if (tags['GPSAltitude']) {
        const alt = tags['GPSAltitude'].description;
        const parsed = typeof alt === 'number' ? alt : parseFloat(String(alt));
        if (!isNaN(parsed)) {
          gpsAltitude = parsed;
        }
      }

      if (!make && !model && !dateTimeOriginal && gpsLatitude === undefined && !software) {
        return null;
      }

      return {
        make,
        model,
        dateTimeOriginal,
        gpsLatitude,
        gpsLongitude,
        gpsAltitude,
        software,
        orientation,
      };
    } catch (err) {
      logger.debug(`[ExifService] No EXIF tags found or extraction skipped for ${fileUri}: ${err}`);
      return null;
    }
  }
}

export const exifService = new ExifService();
