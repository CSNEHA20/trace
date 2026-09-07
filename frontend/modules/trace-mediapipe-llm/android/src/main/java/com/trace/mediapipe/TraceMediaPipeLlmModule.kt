package com.trace.mediapipe

import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.io.File

/**
 * Android bridge for MediaPipe's local Gemma LLM runtime.
 * Executes on-device offline inference without any network or cloud fallbacks.
 * The model (.bin or .task) is loaded strictly from TRACE's private files directory.
 */
class TraceMediaPipeLlmModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var inference: LlmInference? = null
  private var loadedModelPath: String? = null

  override fun getName() = "TraceMediaPipeLlm"

  private fun resolveModelFile(configuredPath: String?): File {
    if (!configuredPath.isNullOrBlank()) {
      val clean = configuredPath.removePrefix("files/").removePrefix("/")
      val customFile = if (clean.startsWith("/")) File(clean) else File(reactApplicationContext.filesDir, clean)
      if (customFile.isFile && customFile.length() > 0L) return customFile
    }
    // Check candidate official filenames in order of preference
    val candidate1 = File(reactApplicationContext.filesDir, "trace-models/gemma-2b-it-cpu-int4.bin")
    if (candidate1.isFile && candidate1.length() > 0L) return candidate1
    val candidate2 = File(reactApplicationContext.filesDir, "trace-models/gemma-2b-it-int4.task")
    if (candidate2.isFile && candidate2.length() > 0L) return candidate2
    val candidate3 = File(reactApplicationContext.filesDir, "trace-models/gemma-2b-it-gpu-int4.bin")
    if (candidate3.isFile && candidate3.length() > 0L) return candidate3

    return candidate1
  }

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    try {
      val modelFile = resolveModelFile(null)
      val map = Arguments.createMap()
      val exists = modelFile.isFile && modelFile.length() > 0L

      map.putString("availability", if (exists) "AVAILABLE" else "MODEL_MISSING")
      map.putString("lifecycle", if (inference == null) "UNLOADED" else "READY")
      map.putString("modelPath", modelFile.absolutePath)
      map.putString("accelerator", "MediaPipe Android On-Device Runtime (CPU / XNNPACK)")
      map.putDouble("modelSizeBytes", if (exists) modelFile.length().toDouble() else 0.0)
      map.putString(
        "detail",
        if (exists) "Local Gemma 2B INT4 model found (${modelFile.length() / (1024 * 1024)} MB). Inference runs strictly on-device."
        else "Place gemma-2b-it-cpu-int4.bin or gemma-2b-it-int4.task in trace-models/ within TRACE private storage."
      )
      promise.resolve(map)
    } catch (error: Exception) {
      promise.reject("CAPABILITIES_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun loadModel(config: ReadableMap, promise: Promise) {
    try {
      val rawPath = if (config.hasKey("modelPath")) config.getString("modelPath") else null
      val modelFile = resolveModelFile(rawPath)

      if (!modelFile.exists()) {
        throw IllegalStateException("Model file not found at: ${modelFile.absolutePath}")
      }
      if (!modelFile.isFile || modelFile.length() == 0L) {
        throw IllegalStateException("Model file is empty (0 bytes) or not a regular file: ${modelFile.absolutePath}")
      }

      // Unload any existing active inference instance
      inference?.close()
      inference = null
      loadedModelPath = null

      val maxTokens = if (config.hasKey("maxTokens")) config.getInt("maxTokens") else 512
      val topK = if (config.hasKey("topK")) config.getInt("topK") else 40
      val temperature = if (config.hasKey("temperature")) config.getDouble("temperature").toFloat() else 0.2f

      val options = LlmInference.LlmInferenceOptions.builder()
        .setModelPath(modelFile.absolutePath)
        .setMaxTokens(maxTokens)
        .setTopK(topK)
        .setTemperature(temperature)
        .build()

      inference = LlmInference.createFromOptions(reactApplicationContext, options)
      loadedModelPath = modelFile.absolutePath

      val resultMap = Arguments.createMap()
      resultMap.putBoolean("loaded", true)
      resultMap.putString("modelPath", modelFile.absolutePath)
      resultMap.putDouble("modelSizeBytes", modelFile.length().toDouble())
      promise.resolve(resultMap)
    } catch (error: Exception) {
      inference = null
      loadedModelPath = null
      promise.reject("MODEL_LOAD_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun generate(prompt: String, promise: Promise) {
    val runtime = inference ?: run {
      promise.reject("MODEL_NOT_LOADED", "Gemma on-device model is not loaded. Load model before running inference.")
      return
    }

    if (prompt.isBlank()) {
      promise.reject("EMPTY_PROMPT", "Input prompt cannot be empty.")
      return
    }

    try {
      val response = runtime.generateResponse(prompt)
      promise.resolve(response)
    } catch (error: Exception) {
      promise.reject("INFERENCE_FAILED", error.message ?: "Native MediaPipe LLM generation failed.", error)
    }
  }

  @ReactMethod
  fun isModelLoaded(promise: Promise) {
    val map = Arguments.createMap()
    map.putBoolean("isLoaded", inference != null)
    map.putString("loadedModelPath", loadedModelPath)
    promise.resolve(map)
  }

  @ReactMethod
  fun unloadModel(promise: Promise) {
    try {
      inference?.close()
      inference = null
      loadedModelPath = null
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("MODEL_UNLOAD_FAILED", error.message, error)
    }
  }
}
