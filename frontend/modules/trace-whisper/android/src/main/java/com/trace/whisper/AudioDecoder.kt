package com.trace.whisper

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Native Android Audio Decoder for Whisper.cpp.
 * 
 * Uses Android's built-in MediaExtractor and MediaCodec APIs (minSdk 26+)
 * to decode any Android-supported audio format (WAV, MP3, M4A/AAC, OGG Opus, FLAC)
 * into a 16kHz 16-bit mono Float PCM buffer (FloatArray) normalized to [-1.0, 1.0].
 */
object AudioDecoder {

  const val TARGET_SAMPLE_RATE = 16000

  data class DecodedAudio(
    val samples: FloatArray,
    val sampleRate: Int,
    val channels: Int,
    val durationSeconds: Double
  )

  fun decodeToPcmF32(file: File): DecodedAudio {
    if (!file.exists() || !file.isFile || file.length() == 0L) {
      throw IllegalArgumentException("Audio file is missing or empty: ${file.absolutePath}")
    }

    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(file.absolutePath)
    } catch (e: Exception) {
      extractor.release()
      throw IllegalStateException("Failed to read audio file: ${e.message}", e)
    }

    var audioTrackIndex = -1
    var format: MediaFormat? = null
    for (i in 0 until extractor.trackCount) {
      val trackFormat = extractor.getTrackFormat(i)
      val mime = trackFormat.getString(MediaFormat.KEY_MIME) ?: ""
      if (mime.startsWith("audio/")) {
        audioTrackIndex = i
        format = trackFormat
        break
      }
    }

    if (audioTrackIndex < 0 || format == null) {
      extractor.release()
      throw IllegalArgumentException("No audio track found in file: ${file.name}")
    }

    extractor.selectTrack(audioTrackIndex)
    val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
    val inputSampleRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
    val channelCount = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 1
    val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L
    val durationSec = if (durationUs > 0) durationUs / 1_000_000.0 else 0.0

    val codec = MediaCodec.createDecoderByType(mime)
    codec.configure(format, null, null, 0)
    codec.start()

    val outStream = java.io.ByteArrayOutputStream(1024 * 128)
    val bufferInfo = MediaCodec.BufferInfo()
    var isExtractorEOS = false
    var isDecoderEOS = false
    val kTimeoutUs = 5000L
    var emptyPollCount = 0
    val maxEmptyPollsAfterExtractorEOS = 50

    try {
      while (!isDecoderEOS) {
        if (!isExtractorEOS) {
          val inIndex = codec.dequeueInputBuffer(kTimeoutUs)
          if (inIndex >= 0) {
            val inBuffer = codec.getInputBuffer(inIndex)
            if (inBuffer != null) {
              val sampleSize = extractor.readSampleData(inBuffer, 0)
              if (sampleSize < 0) {
                codec.queueInputBuffer(inIndex, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                isExtractorEOS = true
              } else {
                codec.queueInputBuffer(inIndex, 0, sampleSize, extractor.sampleTime, 0)
                extractor.advance()
              }
            }
          }
        }

        val outIndex = codec.dequeueOutputBuffer(bufferInfo, kTimeoutUs)
        if (outIndex >= 0) {
          emptyPollCount = 0
          val outBuffer = codec.getOutputBuffer(outIndex)
          if (outBuffer != null && bufferInfo.size > 0) {
            outBuffer.position(bufferInfo.offset)
            outBuffer.limit(bufferInfo.offset + bufferInfo.size)
            val chunk = ByteArray(bufferInfo.size)
            outBuffer.get(chunk)
            outStream.write(chunk)
          }
          codec.releaseOutputBuffer(outIndex, false)
          if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
            isDecoderEOS = true
          }
        } else if (isExtractorEOS) {
          emptyPollCount++
          if (emptyPollCount >= maxEmptyPollsAfterExtractorEOS) {
            isDecoderEOS = true
          }
        }
      }
    } finally {
      try {
        codec.stop()
      } catch (_: Exception) {}
      try {
        codec.release()
      } catch (_: Exception) {}
      try {
        extractor.release()
      } catch (_: Exception) {}
    }

    val pcmByteArray = outStream.toByteArray()
    if (pcmByteArray.isEmpty()) {
      return DecodedAudio(FloatArray(0), TARGET_SAMPLE_RATE, 1, durationSec)
    }

    // Convert raw 16-bit PCM bytes to FloatArray
    val shortBuffer = ByteBuffer.wrap(pcmByteArray).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
    val shortCount = shortBuffer.remaining()
    val rawShorts = ShortArray(shortCount)
    shortBuffer.get(rawShorts)

    // Downmix to mono if multi-channel
    val monoFloats = if (channelCount > 1) {
      val frames = shortCount / channelCount
      val mono = FloatArray(frames)
      for (f in 0 until frames) {
        var sum = 0.0f
        for (c in 0 until channelCount) {
          sum += rawShorts[f * channelCount + c] / 32768.0f
        }
        mono[f] = sum / channelCount
      }
      mono
    } else {
      val mono = FloatArray(shortCount)
      for (i in 0 until shortCount) {
        mono[i] = rawShorts[i] / 32768.0f
      }
      mono
    }

    // Resample to 16000 Hz if necessary using linear interpolation
    val finalSamples = if (inputSampleRate != TARGET_SAMPLE_RATE && inputSampleRate > 0) {
      val ratio = inputSampleRate.toDouble() / TARGET_SAMPLE_RATE.toDouble()
      val outputLength = (monoFloats.size / ratio).toInt()
      val resampled = FloatArray(outputLength)
      for (i in 0 until outputLength) {
        val srcIndex = i * ratio
        val srcIndexFloor = srcIndex.toInt()
        val frac = (srcIndex - srcIndexFloor).toFloat()
        val s0 = if (srcIndexFloor < monoFloats.size) monoFloats[srcIndexFloor] else 0.0f
        val s1 = if (srcIndexFloor + 1 < monoFloats.size) monoFloats[srcIndexFloor + 1] else s0
        resampled[i] = s0 + frac * (s1 - s0)
      }
      resampled
    } else {
      monoFloats
    }

    val computedDuration = if (durationSec > 0.0) durationSec else (finalSamples.size.toDouble() / TARGET_SAMPLE_RATE.toDouble())

    return DecodedAudio(
      samples = finalSamples,
      sampleRate = TARGET_SAMPLE_RATE,
      channels = 1,
      durationSeconds = computedDuration
    )
  }
}
