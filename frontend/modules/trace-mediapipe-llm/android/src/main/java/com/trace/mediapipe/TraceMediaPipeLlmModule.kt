package com.trace.mediapipe

import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.io.File

/**
 * Android bridge for MediaPipe's local LLM runtime. No network client is
 * created here; the .task model is loaded only from TRACE's private files dir.
 */
class TraceMediaPipeLlmModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var inference: LlmInference? = null
  override fun getName() = "TraceMediaPipeLlm"

  @ReactMethod fun getCapabilities(promise: Promise) {
    val model = File(reactApplicationContext.filesDir, "trace-models/gemma-2b-it-int4.task")
    val map = Arguments.createMap()
    map.putString("availability", if (model.isFile && model.length() > 0) "AVAILABLE" else "MODEL_MISSING")
    map.putString("lifecycle", if (inference == null) "UNLOADED" else "READY")
    map.putString("modelPath", model.absolutePath)
    map.putString("accelerator", "MediaPipe Android local runtime")
    map.putString("detail", if (model.isFile) "Local Gemma model found. Inference remains offline." else "Place the licensed Gemma .task model in the TRACE private model directory.")
    promise.resolve(map)
  }

  @ReactMethod fun loadModel(config: ReadableMap, promise: Promise) {
    try {
      val relative = config.getString("modelPath")?.removePrefix("files/") ?: throw IllegalArgumentException("Missing model path")
      val model = File(reactApplicationContext.filesDir, relative)
      if (!model.isFile || model.length() == 0L) throw IllegalStateException("Gemma .task model is not available locally.")
      inference?.close()
      val options = LlmInference.LlmInferenceOptions.builder()
        .setModelPath(model.absolutePath)
        .setMaxTokens(config.getInt("maxTokens"))
        .setTopK(40)
        .setTemperature(0.2f)
        .build()
      inference = LlmInference.createFromOptions(reactApplicationContext, options)
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("MODEL_LOAD_FAILED", error.message, error) }
  }

  @ReactMethod fun generate(prompt: String, promise: Promise) {
    val runtime = inference ?: run { promise.reject("MODEL_NOT_LOADED", "Load the local Gemma model before inference."); return }
    try { promise.resolve(runtime.generateResponse(prompt)) }
    catch (error: Exception) { promise.reject("INFERENCE_FAILED", error.message, error) }
  }

  @ReactMethod fun unloadModel(promise: Promise) {
    try { inference?.close(); inference = null; promise.resolve(null) }
    catch (error: Exception) { promise.reject("MODEL_UNLOAD_FAILED", error.message, error) }
  }
}
