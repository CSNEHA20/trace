package com.trace.mediapipe

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * TRACE Android Bridge for MediaPipe Gemma 2B INT4 On-Device LLM.
 *
 * Safety rules enforced:
 * - loadModel() and generate() run on Dispatchers.IO (background thread).
 *   The React Native bridge thread is NEVER blocked — prevents ANR / OS kill.
 * - Free memory is checked before loading; rejects with clear error if < 1.8 GB free.
 * - Prompts are hard-truncated to MAX_PROMPT_CHARS to prevent runaway generation time.
 * - Model is auto-unloaded after each generate() call to free ~1.5 GB RAM immediately.
 */
class TraceMediaPipeLlmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var inference: LlmInference? = null
    private var loadedModelPath: String? = null

    companion object {
        /** Hard cap on prompt characters — prevents multi-minute generation that freezes the device */
        private const val MAX_PROMPT_CHARS = 2048
        /** Minimum free RAM required to safely load Gemma 2B INT4 (~1.5 GB model) */
        private const val MIN_FREE_RAM_BYTES = 1_800L * 1024L * 1024L // 1.8 GB
        /** Maximum output tokens — keep short to reduce generation time on CPU */
        private const val DEFAULT_MAX_TOKENS = 256
    }

    override fun getName() = "TraceMediaPipeLlm"

    // ── Helpers ────────────────────────────────────────────────────────────────

    private fun resolveModelFile(configuredPath: String?): File {
        if (!configuredPath.isNullOrBlank()) {
            val clean = configuredPath.removePrefix("files/").removePrefix("/")
            val custom = if (clean.startsWith("/")) File(clean)
                         else File(reactContext.filesDir, clean)
            if (custom.isFile && custom.length() > 0L) return custom
        }
        val candidates = listOf(
            "trace-models/gemma-2b-it-cpu-int4.bin",
            "trace-models/gemma-2b-it-int4.task",
            "trace-models/gemma-2b-it-gpu-int4.bin"
        ).map { File(reactContext.filesDir, it) }

        return candidates.firstOrNull { it.isFile && it.length() > 0L } ?: candidates[0]
    }

    private fun getFreeRamBytes(): Long {
        val am = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        return info.availMem
    }

    private fun unloadInference() {
        try { inference?.close() } catch (_: Exception) {}
        inference = null
        loadedModelPath = null
    }

    // ── React Methods ──────────────────────────────────────────────────────────

    @ReactMethod
    fun getCapabilities(promise: Promise) {
        scope.launch {
            try {
                val modelFile = resolveModelFile(null)
                val exists = modelFile.isFile && modelFile.length() > 0L
                val freeRam = getFreeRamBytes()
                val map = Arguments.createMap().apply {
                    putString("availability", if (exists) "AVAILABLE" else "MODEL_MISSING")
                    putString("lifecycle", if (inference == null) "UNLOADED" else "READY")
                    putString("modelPath", modelFile.absolutePath)
                    putString("accelerator", "MediaPipe Android On-Device Runtime (CPU / XNNPACK)")
                    putDouble("modelSizeBytes", if (exists) modelFile.length().toDouble() else 0.0)
                    putDouble("freeRamBytes", freeRam.toDouble())
                    putString(
                        "detail",
                        if (exists)
                            "Local Gemma 2B INT4 found (${modelFile.length() / (1024 * 1024)} MB). " +
                            "Free RAM: ${freeRam / (1024 * 1024)} MB. Inference runs strictly on-device."
                        else
                            "Place gemma-2b-it-cpu-int4.bin or gemma-2b-it-int4.task in " +
                            "trace-models/ within TRACE private storage."
                    )
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("CAPABILITIES_ERROR", e.message ?: "Failed to read capabilities", e)
            }
        }
    }

    @ReactMethod
    fun loadModel(config: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val rawPath = if (config.hasKey("modelPath")) config.getString("modelPath") else null
                val modelFile = resolveModelFile(rawPath)

                if (!modelFile.exists() || !modelFile.isFile || modelFile.length() == 0L) {
                    promise.reject(
                        "MODEL_NOT_FOUND",
                        "Model file not found or empty at: ${modelFile.absolutePath}. " +
                        "Copy gemma-2b-it-cpu-int4.bin into the app's trace-models/ folder."
                    )
                    return@launch
                }

                // Memory guard — reject before trying to load if RAM is insufficient
                val freeRam = getFreeRamBytes()
                if (freeRam < MIN_FREE_RAM_BYTES) {
                    promise.reject(
                        "INSUFFICIENT_MEMORY",
                        "Not enough free RAM to load Gemma 2B. " +
                        "Free: ${freeRam / (1024 * 1024)} MB, Required: ~1800 MB. " +
                        "Close other apps and try again."
                    )
                    return@launch
                }

                // Unload any existing model first
                unloadInference()

                val maxTokens = if (config.hasKey("maxTokens")) config.getInt("maxTokens") else DEFAULT_MAX_TOKENS
                val topK      = if (config.hasKey("topK")) config.getInt("topK") else 40
                val temp      = if (config.hasKey("temperature")) config.getDouble("temperature").toFloat() else 0.2f

                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelFile.absolutePath)
                    .setMaxTokens(maxTokens)
                    .setTopK(topK)
                    .setTemperature(temp)
                    .build()

                // LlmInference.createFromOptions is blocking — safe on IO dispatcher
                inference = LlmInference.createFromOptions(reactContext, options)
                loadedModelPath = modelFile.absolutePath

                val result = Arguments.createMap().apply {
                    putBoolean("loaded", true)
                    putString("modelPath", modelFile.absolutePath)
                    putDouble("modelSizeBytes", modelFile.length().toDouble())
                }
                promise.resolve(result)
            } catch (e: OutOfMemoryError) {
                unloadInference()
                promise.reject(
                    "OUT_OF_MEMORY",
                    "Device ran out of memory loading Gemma 2B. Close other apps and retry.",
                    Exception(e)
                )
            } catch (e: Exception) {
                unloadInference()
                promise.reject("MODEL_LOAD_FAILED", e.message ?: "Failed to load model", e)
            }
        }
    }

    @ReactMethod
    fun generate(prompt: String, promise: Promise) {
        scope.launch {
            try {
                // Load model if not already loaded (lazy load on first generate)
                if (inference == null) {
                    val modelFile = resolveModelFile(null)
                    if (!modelFile.isFile || modelFile.length() == 0L) {
                        promise.reject(
                            "MODEL_NOT_FOUND",
                            "Gemma model file not found. Cannot run analysis."
                        )
                        return@launch
                    }
                    val freeRam = getFreeRamBytes()
                    if (freeRam < MIN_FREE_RAM_BYTES) {
                        promise.reject(
                            "INSUFFICIENT_MEMORY",
                            "Not enough RAM to load Gemma 2B. Free: ${freeRam / (1024 * 1024)} MB. " +
                            "Required: ~1800 MB. Close other apps."
                        )
                        return@launch
                    }
                    val options = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelFile.absolutePath)
                        .setMaxTokens(DEFAULT_MAX_TOKENS)
                        .setTopK(40)
                        .setTemperature(0.2f)
                        .build()
                    inference = LlmInference.createFromOptions(reactContext, options)
                    loadedModelPath = modelFile.absolutePath
                }

                val runtime = inference!!

                if (prompt.isBlank()) {
                    promise.reject("EMPTY_PROMPT", "Input prompt cannot be empty.")
                    return@launch
                }

                // Hard-truncate prompt to prevent multi-minute generation on CPU
                val safePropmt = if (prompt.length > MAX_PROMPT_CHARS)
                    prompt.substring(0, MAX_PROMPT_CHARS) + "\n[CONTEXT TRUNCATED FOR PERFORMANCE]"
                else prompt

                // generateResponse is blocking — safe on IO dispatcher
                val response = runtime.generateResponse(safePropmt)

                if (response.isNullOrBlank()) {
                    promise.reject("EMPTY_RESPONSE", "Gemma returned an empty response.")
                    return@launch
                }

                promise.resolve(response)

                // Immediately unload after generation to free ~1.5 GB RAM
                unloadInference()

            } catch (e: OutOfMemoryError) {
                unloadInference()
                promise.reject(
                    "OUT_OF_MEMORY",
                    "Device ran out of memory during generation. Model unloaded. Try again.",
                    Exception(e)
                )
            } catch (e: Exception) {
                unloadInference()
                promise.reject("INFERENCE_FAILED", e.message ?: "Native MediaPipe LLM generation failed.", e)
            }
        }
    }

    @ReactMethod
    fun isModelLoaded(promise: Promise) {
        scope.launch {
            val map = Arguments.createMap().apply {
                putBoolean("isLoaded", inference != null)
                putString("loadedModelPath", loadedModelPath)
            }
            promise.resolve(map)
        }
    }

    @ReactMethod
    fun unloadModel(promise: Promise) {
        scope.launch {
            try {
                unloadInference()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("MODEL_UNLOAD_FAILED", e.message ?: "Unload failed", e)
            }
        }
    }
}
