package com.trace

import android.content.Context
import android.os.Debug
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

private const val TAG = "TRACE_GEMMA_VALIDATION"

@RunWith(AndroidJUnit4::class)
class GemmaHardwareValidationTest {

    private fun getMemoryInfoMB(): Double {
        val runtime = Runtime.getRuntime()
        val usedMem = (runtime.totalMemory() - runtime.freeMemory()).toDouble() / (1024.0 * 1024.0)
        return usedMem
    }

    private fun getNativeHeapAllocatedMB(): Double {
        return Debug.getNativeHeapAllocatedSize().toDouble() / (1024.0 * 1024.0)
    }

    @Test
    fun executeRealGemmaCpuValidationSuite() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val modelFile = File(context.filesDir, "trace-models/gemma-2b-it-cpu-int4.bin")

        Log.i(TAG, "==================================================")
        Log.i(TAG, "TRACE STEP 7.9 REAL GEMMA 2B CPU VALIDATION")
        Log.i(TAG, "Model path: ${modelFile.absolutePath}")
        Log.i(TAG, "Model exists: ${modelFile.exists()}, length: ${modelFile.length()} bytes")
        Log.i(TAG, "==================================================")

        assertTrue("Model file must exist at ${modelFile.absolutePath}", modelFile.exists() && modelFile.length() > 0)

        // Memory before load
        val jvmMemBeforeMB = getMemoryInfoMB()
        val nativeHeapBeforeMB = getNativeHeapAllocatedMB()
        Log.i(TAG, "MEMORY_BEFORE_LOAD: JVM=${String.format("%.2f", jvmMemBeforeMB)} MB, NativeHeap=${String.format("%.2f", nativeHeapBeforeMB)} MB")

        // PHASE 12: REAL CPU MODEL LOAD
        Log.i(TAG, "PHASE 12: Starting LlmInference.createFromOptions for CPU model...")
        val loadStart = System.currentTimeMillis()
        val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(modelFile.absolutePath)
            .setMaxTokens(512)
            .setTopK(40)
            .setTemperature(0.2f)
            .build()

        var llmInference: LlmInference? = null
        var loadDurationMs = 0L
        try {
            llmInference = LlmInference.createFromOptions(context, options)
            loadDurationMs = System.currentTimeMillis() - loadStart
            Log.i(TAG, "MODEL_LOAD_SUCCESS: loadDurationMs=$loadDurationMs")
        } catch (e: Throwable) {
            loadDurationMs = System.currentTimeMillis() - loadStart
            Log.e(TAG, "MODEL_LOAD_FAILED after ${loadDurationMs}ms: ${e.message}", e)
            fail("Model loading failed: ${e.message}")
        }

        assertNotNull("LlmInference instance must not be null", llmInference)

        val jvmMemAfterMB = getMemoryInfoMB()
        val nativeHeapAfterMB = getNativeHeapAllocatedMB()
        Log.i(TAG, "MEMORY_AFTER_LOAD: JVM=${String.format("%.2f", jvmMemAfterMB)} MB, NativeHeap=${String.format("%.2f", nativeHeapAfterMB)} MB")

        val inference = llmInference!!

        try {
            // PHASE 13: REAL PROOF-OF-LIFE INFERENCE
            Log.i(TAG, "PHASE 13: Starting Proof-of-life inference...")
            val proofOfLifePrompt = "You are TRACE.\nReturn exactly one JSON object:\n{\n  \"test\": \"gemma_cpu_runtime\",\n  \"status\": \"success\"\n}\nDo not add markdown.\nDo not add explanation."
            val polStart = System.currentTimeMillis()
            val polOutput = inference.generateResponse(proofOfLifePrompt)
            val polDurationMs = System.currentTimeMillis() - polStart

            Log.i(TAG, "PROOF_OF_LIFE_RESULT:")
            Log.i(TAG, ">>> DURATION_MS: $polDurationMs")
            Log.i(TAG, ">>> RAW_OUTPUT:\n$polOutput\n<<< END RAW_OUTPUT")

            assertNotNull("Proof of life output must not be null", polOutput)
            assertTrue("Proof of life output must not be blank", polOutput.isNotBlank())

            // PHASE 14: FORENSIC MICRO-TESTS
            Log.i(TAG, "PHASE 14: Starting Forensic Micro-Tests...")

            // Test 1: Threat extraction
            val prompt1 = "Extract the threat from this evidence:\n\n\"I will publish your private photos if you do not pay me.\""
            val t1Start = System.currentTimeMillis()
            val t1Output = inference.generateResponse(prompt1)
            val t1DurationMs = System.currentTimeMillis() - t1Start
            Log.i(TAG, "MICRO_TEST_1_THREAT:")
            Log.i(TAG, ">>> DURATION_MS: $t1DurationMs")
            Log.i(TAG, ">>> RAW_OUTPUT:\n$t1Output\n<<< END RAW_OUTPUT")

            // Test 2: Communication channel
            val prompt2 = "Identify the communication channel from:\n\n\"Send the money through this UPI ID.\""
            val t2Start = System.currentTimeMillis()
            val t2Output = inference.generateResponse(prompt2)
            val t2DurationMs = System.currentTimeMillis() - t2Start
            Log.i(TAG, "MICRO_TEST_2_CHANNEL:")
            Log.i(TAG, ">>> DURATION_MS: $t2DurationMs")
            Log.i(TAG, ">>> RAW_OUTPUT:\n$t2Output\n<<< END RAW_OUTPUT")

            // Test 3: Summarize evidence
            val prompt3 = "Summarize this evidence:\n\n\"Meet me tomorrow at 8 PM or I will send the screenshots to everyone.\""
            val t3Start = System.currentTimeMillis()
            val t3Output = inference.generateResponse(prompt3)
            val t3DurationMs = System.currentTimeMillis() - t3Start
            Log.i(TAG, "MICRO_TEST_3_SUMMARY:")
            Log.i(TAG, ">>> DURATION_MS: $t3DurationMs")
            Log.i(TAG, ">>> RAW_OUTPUT:\n$t3Output\n<<< END RAW_OUTPUT")

            // PHASE 15: REPEATED INFERENCE STABILITY (3 sequential calls)
            Log.i(TAG, "PHASE 15: Starting Repeated Inference Stability (3 calls)...")
            for (i in 1..3) {
                val repPrompt = "Analyze evidence item $i: Victim received a fraudulent call demanding bank OTP."
                val repStart = System.currentTimeMillis()
                val repOutput = inference.generateResponse(repPrompt)
                val repDurationMs = System.currentTimeMillis() - repStart
                Log.i(TAG, "STABILITY_CALL_$i: durationMs=$repDurationMs, outputLength=${repOutput.length}")
                Log.i(TAG, ">>> STABILITY_OUTPUT_$i:\n$repOutput\n<<< END")
            }

            val jvmMemFinalMB = getMemoryInfoMB()
            val nativeHeapFinalMB = getNativeHeapAllocatedMB()
            Log.i(TAG, "MEMORY_FINAL: JVM=${String.format("%.2f", jvmMemFinalMB)} MB, NativeHeap=${String.format("%.2f", nativeHeapFinalMB)} MB")

            Log.i(TAG, "ALL_PHASES_COMPLETED_SUCCESSFULLY")
        } finally {
            inference.close()
            Log.i(TAG, "INFERENCE_CLOSED")
        }
    }

    @Test
    fun executeOfflineGemmaCpuInference() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val modelFile = File(context.filesDir, "trace-models/gemma-2b-it-cpu-int4.bin")

        Log.i(TAG, "==================================================")
        Log.i(TAG, "PHASE 16: OFFLINE REAL GEMMA 2B CPU INFERENCE TEST")
        Log.i(TAG, "Model path: ${modelFile.absolutePath}")
        Log.i(TAG, "==================================================")

        val jvmBeforeMB = getMemoryInfoMB()
        val nativeBeforeMB = getNativeHeapAllocatedMB()
        Log.i(TAG, "OFFLINE_TEST_MEMORY_BEFORE: JVM=${String.format("%.2f", jvmBeforeMB)} MB, NativeHeap=${String.format("%.2f", nativeBeforeMB)} MB")

        val loadStart = System.currentTimeMillis()
        val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(modelFile.absolutePath)
            .setMaxTokens(256)
            .setTopK(40)
            .setTemperature(0.2f)
            .build()

        val inference = LlmInference.createFromOptions(context, options)
        val loadDurationMs = System.currentTimeMillis() - loadStart
        Log.i(TAG, "OFFLINE_MODEL_LOAD_SUCCESS: loadDurationMs=$loadDurationMs")

        try {
            val offlinePrompt = "Extract key entities from: \"Suspect Alex requested payment to Bitcoin wallet 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa\""
            val genStart = System.currentTimeMillis()
            val output = inference.generateResponse(offlinePrompt)
            val genDurationMs = System.currentTimeMillis() - genStart

            Log.i(TAG, "OFFLINE_INFERENCE_RESULT:")
            Log.i(TAG, ">>> DURATION_MS: $genDurationMs")
            Log.i(TAG, ">>> RAW_OUTPUT:\n$output\n<<< END OFFLINE OUTPUT")

            assertNotNull("Offline output must not be null", output)
            assertTrue("Offline output must not be blank", output.isNotBlank())
            Log.i(TAG, "OFFLINE_TEST_PASSED_COMPLETELY")
        } finally {
            inference.close()
            Log.i(TAG, "OFFLINE_INFERENCE_CLOSED")
        }
    }

    @Test
    fun executeStep8ForensicGroundingHardwareValidation() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val modelFile = File(context.filesDir, "trace-models/gemma-2b-it-cpu-int4.bin")

        Log.i(TAG, "==================================================")
        Log.i(TAG, "TRACE STEP 8: REAL HARDWARE FORENSIC EXTRACTION & GROUNDING")
        Log.i(TAG, "Model path: ${modelFile.absolutePath}")
        Log.i(TAG, "==================================================")

        val jvmBeforeMB = getMemoryInfoMB()
        val nativeBeforeMB = getNativeHeapAllocatedMB()
        Log.i(TAG, "STEP8_MEMORY_BEFORE: JVM=${String.format("%.2f", jvmBeforeMB)} MB, NativeHeap=${String.format("%.2f", nativeBeforeMB)} MB")

        val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(modelFile.absolutePath)
            .setMaxTokens(512)
            .setTopK(40)
            .setTemperature(0.2f)
            .build()

        val inference = LlmInference.createFromOptions(context, options)

        try {
            val prompt = """
You are TRACE, a local on-device forensic evidence analysis engine.
Strict Rules:
- Analyze ONLY the supplied evidence text and metadata.
- Do NOT invent, assume, or manufacture facts, dates, timestamps, individuals, phone numbers, URLs, or events.
- If information is missing or not mentioned, return empty arrays or null.
- Every fact and event MUST cite the sourceEvidenceId from the evidence item.
- Distinguish certainty: "explicit" vs "inferred".
- Return ONLY valid raw JSON conforming strictly to the requested schema. No conversational filler, no markdown formatting fences.

EVIDENCE CONTEXT:
EVIDENCE_ITEM_START
ID: ev-photo-threat-1
TYPE: IMAGE
FILE: threat_chat.jpg
TIMESTAMP: 2026-09-08T08:00:00.000Z
OCR_TEXT:
I will publish your private photos if you do not pay me $5,000 to UPI ID victim@okbank or call 9876543210.
TRANSCRIPT:
[None]
SHA256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
EVIDENCE_ITEM_END

STRUCTURED FORENSIC JSON RESPONSE:
""".trimIndent()

            val genStart = System.currentTimeMillis()
            val output = inference.generateResponse(prompt)
            val genDurationMs = System.currentTimeMillis() - genStart

            Log.i(TAG, "STEP8_FORENSIC_EXTRACTION_RESULT:")
            Log.i(TAG, ">>> DURATION_MS: $genDurationMs")
            Log.i(TAG, ">>> RAW_OUTPUT:\n$output\n<<< END STEP8 OUTPUT")

            assertNotNull("Step 8 output must not be null", output)
            assertTrue("Step 8 output must not be blank", output.isNotBlank())
            Log.i(TAG, "STEP8_HARDWARE_VALIDATION_PASSED")
        } finally {
            inference.close()
            Log.i(TAG, "STEP8_INFERENCE_CLOSED")
        }
    }

    @Test
    fun executeStep81ProvenanceHardeningValidation() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val modelFile = File(context.filesDir, "trace-models/gemma-2b-it-cpu-int4.bin")

        Log.i(TAG, "==================================================")
        Log.i(TAG, "TRACE STEP 8.1: REAL HARDWARE PROVENANCE HARDENING VALIDATION")
        Log.i(TAG, "Model path: ${modelFile.absolutePath}")
        Log.i(TAG, "==================================================")

        val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(modelFile.absolutePath)
            .setMaxTokens(512)
            .setTopK(40)
            .setTemperature(0.2f)
            .build()

        val inference = LlmInference.createFromOptions(context, options)

        try {
            val prompt = """
You are TRACE, a local on-device forensic evidence analysis engine.
Strict Rules:
- Analyze ONLY the supplied evidence items.
- Every fact and event MUST cite the exact sourceEvidenceId from which it was extracted.
- If information is not in an evidence item, do not manufacture an evidence ID.
- Return ONLY JSON conforming to schema: {"extractedFacts":[{"fact":"string","sourceEvidenceId":"id","certainty":"explicit"}]}

EVIDENCE CONTEXT:
EVIDENCE_ITEM_START
ID: ev-photo-threat-1
OCR_TEXT: I will publish your private photos if you do not pay $5,000.
EVIDENCE_ITEM_END

EVIDENCE_ITEM_START
ID: ev-audio-call-2
TRANSCRIPT: Alex speaking. Send the money through UPI ID victim@okbank.
EVIDENCE_ITEM_END

STRUCTURED FORENSIC JSON RESPONSE:
""".trimIndent()

            val genStart = System.currentTimeMillis()
            val output = inference.generateResponse(prompt)
            val genDurationMs = System.currentTimeMillis() - genStart

            Log.i(TAG, "STEP81_PROVENANCE_OUTPUT:")
            Log.i(TAG, ">>> DURATION_MS: $genDurationMs")
            Log.i(TAG, ">>> RAW_OUTPUT:\n$output\n<<< END STEP81 OUTPUT")

            assertNotNull("Output must not be null", output)
            assertTrue("Output must not be blank", output.isNotBlank())
            Log.i(TAG, "STEP81_PROVENANCE_VALIDATION_PASSED")
        } finally {
            inference.close()
            Log.i(TAG, "STEP81_INFERENCE_CLOSED")
        }
    }
}
