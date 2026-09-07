package com.trace.mediapipe

import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.io.File

/**
 * Android bridge for MediaPipe's local Gemma LLM runtime.
 * Executes on-device offline inference without any network or cloud fallbacks.
 * The .task model is loaded strictly from TRACE's private files directory.
 */
class TraceMediaPipeLlmModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var inference: LlmInference? = null
  private var loadedModelPath: String? = null

  override fun getName() = "TraceMediaPipeLlm"

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    try {
      val defaultModelFile = File(reactApplicationContext.filesDir, "trace-models/gemma-2b-it-int4.task")
      val map = Arguments.createMap()
      val exists = defaultModelFile.isFile && defaultModelFile.length() > 0L

      map.putString("availability", if (exists) "AVAILABLE" else "MODEL_MISSING")
      map.putString("lifecycle", if (inference == null) "UNLOADED" else "READY")
      map.putString("modelPath", defaultModelFile.absolutePath)
      map.putString("accelerator", "MediaPipe Android On-Device Runtime")
      map.putDouble("modelSizeBytes", if (exists) defaultModelFile.length().toDouble() else 0.0)
      map.putString(
        "detail",
        if (exists) "Local Gemma 2B INT4 model found (${defaultModelFile.length() / (1024 * 1024)} MB). Inference runs strictly on-device."
        else "Place the compatible Gemma 2B INT4 .task model in trace-models/ within TRACE private storage."
      )
      promise.resolve(map)
    } catch (error: Exception) {
      promise.reject("CAPABILITIES_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun loadModel(config: ReadableMap, promise: Promise) {
    try {
      val rawPath = if (config.hasKey("modelPath")) config.getString("modelPath") else "trace-models/gemma-2b-it-int4.task"
      val cleanPath = (rawPath ?: "trace-models/gemma-2b-it-int4.task").removePrefix("files/").removePrefix("/")

      val modelFile = if (cleanPath.startsWith("/")) {
        File(cleanPath)
      } else {
        File(reactApplicationContext.filesDir, cleanPath)
      }

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
