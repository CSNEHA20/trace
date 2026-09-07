package com.trace.ocr

import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File

/**
 * TRACE Android Native OCR Bridge using Google ML Kit Text Recognition.
 * 
 * Features:
 * - 100% On-Device & Offline: Bundled Latin script model with zero cloud dependencies.
 * - Non-blocking: Coroutine-backed background execution off the main UI thread.
 * - Structured Output: Returns full text, bounding boxes, block lines, and dimensions.
 * - Zero-Mock: Never returns synthetic or hardcoded OCR text.
 */
class TraceOcrModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  private val coroutineScope = CoroutineScope(Dispatchers.IO)
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  override fun getName(): String = "TraceOcr"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    try {
      val map = Arguments.createMap().apply {
        putBoolean("available", true)
        putString("engine", "Google ML Kit Text Recognition")
        putString("model", "Bundled On-Device Latin v2")
        putBoolean("bundled", true)
        putBoolean("offline", true)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("OCR_AVAILABILITY_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun recognizeText(imageUriOrPath: String, promise: Promise) {
    coroutineScope.launch {
      val startTime = System.currentTimeMillis()
      try {
        if (imageUriOrPath.isBlank()) {
          promise.reject("FILE_NOT_FOUND", "Empty image path provided")
          return@launch
        }

        // Resolve clean file path
        val cleanPath = if (imageUriOrPath.startsWith("file://")) {
          Uri.parse(imageUriOrPath).path ?: imageUriOrPath.removePrefix("file://")
        } else {
          imageUriOrPath
        }

        val file = File(cleanPath)
        if (!file.exists() || !file.isFile) {
          promise.reject("FILE_NOT_FOUND", "Evidence file does not exist at: $cleanPath")
          return@launch
        }

        if (!file.canRead() || file.length() == 0L) {
          promise.reject("FILE_UNREADABLE", "Evidence file is unreadable or 0 bytes")
          return@launch
        }

        // Validate image dimensions and format by decoding bounds
        val options = BitmapFactory.Options().apply {
          inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(file.absolutePath, options)
        val imageWidth = options.outWidth
        val imageHeight = options.outHeight
        val mimeType = options.outMimeType

        if (imageWidth <= 0 || imageHeight <= 0 || mimeType == null) {
          promise.reject("NOT_AN_IMAGE", "File is not a valid or decodable image: mime=${mimeType ?: "unknown"}")
          return@launch
        }

        val fileUri = Uri.fromFile(file)
        val inputImage = InputImage.fromFilePath(reactApplicationContext, fileUri)

        recognizer.process(inputImage)
          .addOnSuccessListener { visionText ->
            val endTime = System.currentTimeMillis()
            val resultMap = Arguments.createMap().apply {
              putString("status", "COMPLETED")
              putString("text", visionText.text)
              putInt("imageWidth", imageWidth)
              putInt("imageHeight", imageHeight)
              putString("mimeType", mimeType)
              putDouble("processingTimeMs", (endTime - startTime).toDouble())
              putString("engine", "Google ML Kit Text Recognition (On-Device Latin)")

              val blocksArray = Arguments.createArray()
              for (block in visionText.textBlocks) {
                val blockMap = Arguments.createMap().apply {
                  putString("text", block.text)
                  putString("recognizedLanguage", block.recognizedLanguage)

                  block.boundingBox?.let { box ->
                    val boxMap = Arguments.createMap().apply {
                      putInt("left", box.left)
                      putInt("top", box.top)
                      putInt("right", box.right)
                      putInt("bottom", box.bottom)
                      putInt("width", box.width())
                      putInt("height", box.height())
                    }
                    putMap("boundingBox", boxMap)
                  }

                  val linesArray = Arguments.createArray()
                  for (line in block.lines) {
                    linesArray.pushString(line.text)
                  }
                  putArray("lines", linesArray)
                }
                blocksArray.pushMap(blockMap)
              }
              putArray("blocks", blocksArray)
            }
            promise.resolve(resultMap)
          }
          .addOnFailureListener { err ->
            promise.reject("OCR_ENGINE_ERROR", err.message ?: "ML Kit text recognition failed", err)
          }
      } catch (err: Exception) {
        promise.reject("OCR_ERROR", err.message ?: "OCR operation failed", err)
      }
    }
  }
}
