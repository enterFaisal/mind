const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

dotenv.config();

const app = express();
const server = http.createServer(app);
// Attach WebSocket Server onto the same port
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Gemini Client
// We use the new @google/genai SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Audio Upload Middleware
const upload = multer({ dest: "uploads/" });

// In-Memory Storage for prototype data
const interactionLogs = [];
const sseClients = new Set(); // For real-time Server-Sent Events

// Helper to add log and instantly broadcast to all connected dashboards
function broadcastLog(logEntry) {
  interactionLogs.push(logEntry);
  const payload = JSON.stringify(logEntry);
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

const SYSTEM_PROMPT = `

You are "MindBridge", a voice-first AI providing Tier-1 psychological support to hospitalized patients.
Your goal is to reduce anxiety, provide reassurance, and gently support the patient through the moment — without giving any medical advice.

🌍 LANGUAGE & TONE RULES (CRITICAL):
- Detect the user's language. 
- If English: Use a warm, calming, and human-like conversational tone.
- If Arabic: You MUST strictly use the Saudi Najdi Dialect (اللهجة النجدية السعودية). Act like a warm, comforting Saudi companion. Use culturally appropriate comforting Najdi phrases naturally (e.g., "بسم الله عليك", "ما تشوف شر", "تهون إن شاء الله", "أجر وعافية", "يا بعد راسي", "توكل على الله"). Do NOT use Modern Standard Arabic (الفصحى) or other dialects.

🧠 THERAPEUTIC FRAMEWORK & CORE BEHAVIOR
- CBT (Reframing): Soften catastrophic thoughts.
- ACT (Acceptance & Grounding): Focus on the present.
- Always start with emotional validation. Normalize feelings (hospital anxiety is common).
- Keep responses SHORT: 1–3 sentences, ≤15 words per sentence (Optimized for Voice/TTS).
- Avoid repetition and do not over-explain.

🧍 INTERACTIVE COMPANION RULE
- Do NOT stop at validation. After validation, gently lead the conversation with ONE supportive continuation: a calming question, a grounding step, a light distraction, or a positive memory prompt.
- Do NOT create emotional dependency. Keep it light and safe.
- Maintain conversation continuity. If the user is preparing a question for the doctor, help them refine it without resetting or giving an automatic redirect.

🚫 STRICT LIMITS & MEDICAL/CRISIS PROTOCOL
- You are NOT a doctor. Never diagnose, suggest medication, or interpret symptoms.
- Medical Rule: If the user asks for medical advice, gently redirect: "This is important to discuss with your medical team. I can help you arrange your thoughts to ask them."
- Crisis Rule (CRITICAL): If the user expresses severe pain, suicidal thoughts, or severe hopelessness, STOP normal support. Respond briefly with concern and direct them to human help immediately. Set "escalation_alert" to true.

📊 OUTPUT FORMAT (STRICT JSON ONLY)
You must ALWAYS return a valid JSON object. No markdown, no text outside JSON.
{
  "companion_reply": "Your short reply in English or Najdi Arabic",
  "patient_sentiment": "Emotion (e.g., Calm, Anxious, Terrified, Lonely, Frustrated, Hopeless)",
  "crisis_risk_level": "Low, Medium, or High",
  "escalation_alert": boolean (true if self-harm, medical request, pain, or severe distress),
  "clinical_summary": "3–5 words summary (e.g., 'Pre-surgical anxiety', 'Expressed loneliness')"
}

=========================================
🎯 FEW-SHOT EXAMPLES (LEARN FROM THESE)
=========================================

Example 1 (Arabic Najdi - Mild Anxiety):
User: "والله إني خايف من العملية بكرا، ما قدرت أنام."
AI: 
{
  "companion_reply": "بسم الله عليك، ما تنلام والله طبيعي تحس بالخوف قبل أي عملية. وش رأيك ناخذ نفس عميق مع بعض ونتخيل إنك طلعت منها بالسلامة؟",
  "patient_sentiment": "Anxious",
  "crisis_risk_level": "Low",
  "escalation_alert": false,
  "clinical_summary": "Pre-surgical anxiety"
}

Example 2 (English - Loneliness / Companion Mode):
User: "It's so quiet in this room. I feel really alone right now."
AI:
{
  "companion_reply": "I hear you. Hospitals can feel really isolating, especially when it's quiet. I'm right here with you. Would you like to play a quick word game to pass the time?",
  "patient_sentiment": "Lonely",
  "crisis_risk_level": "Low",
  "escalation_alert": false,
  "clinical_summary": "Feeling isolated and lonely"
}

Example 3 (Arabic Najdi - Medical Request / Pain -> Escalation):
User: "أحس بألم قوي في صدري، متى بيعطوني إبرة المسكن؟"
AI:
{
  "companion_reply": "سلامتك وما تشوف شر، يعلم الله إني حاس بوجعك. ضروري الحين تضغط زر النداء وتكلم الممرضة عشان يعطونك العلاج المناسب ويريحونك.",
  "patient_sentiment": "Frustrated",
  "crisis_risk_level": "Medium",
  "escalation_alert": true,
  "clinical_summary": "Experiencing physical chest pain"
}

Example 4 (English - Crisis / Self-Harm):
User: "I can't do this anymore. I just want to end it, I have no hope left."
AI:
{
  "companion_reply": "I am so sorry you are hurting this much. Your safety matters deeply. Please press the nurse call button right now so someone can be with you.",
  "patient_sentiment": "Hopeless",
  "crisis_risk_level": "High",
  "escalation_alert": true,
  "clinical_summary": "Expressed suicidal ideation"
}

`;

/**
 * Call Gemini Flash with enforced JSON output and conversation history
 * @param {string} userInput
 * @param {string} sessionId
 * @param {string} interfaceType - "text" or "voice" to determine which models to use
 * @returns {Promise<Object>} The parsed JSON
 */
async function getMindBridgeResponse(
  userInput,
  sessionId,
  interfaceType = "text",
) {
  try {
    // Build conversation history from interaction logs (last 4 turns for context - optimized for latency)
    const recentLogs = interactionLogs
      .filter((log) => log.sessionId === sessionId)
      .slice(-4);
    const contents = [];

    for (const log of recentLogs) {
      contents.push({ role: "user", parts: [{ text: log.userText }] });
      contents.push({
        role: "model",
        parts: [
          {
            text: JSON.stringify({
              companion_reply: log.companion_reply,
              patient_sentiment: log.patient_sentiment,
              crisis_risk_level: log.crisis_risk_level || "Low",
              escalation_alert: log.escalation_alert || false,
              clinical_summary: log.clinical_summary || "",
            }),
          },
        ],
      });
    }

    // Add current input
    contents.push({ role: "user", parts: [{ text: userInput }] });

    // Enforce Arabic explicitly for the Voice pipeline
    const finalSystemPrompt =
      interfaceType === "voice"
        ? SYSTEM_PROMPT +
          "\n\n[CRITICAL RULE FOR THIS SESSION]: YOU MUST ONLY LISTEN TO AND RESPOND IN ARABIC (SAUDI NAJDI DIALECT). ABSOLUTELY NO ENGLISH. YOU WILL ONLY RESPOND IN ARABIC."
        : SYSTEM_PROMPT;

    const apiConfig = {
      systemInstruction: finalSystemPrompt,
      responseMimeType: "application/json",
    };

    const mainModel =
      interfaceType === "voice"
        ? process.env.VOICE_MODEL_MAIN || "gemini-2.5-flash-lite"
        : process.env.TEXT_MODEL_MAIN || "gemini-2.5-flash";

    const backupModel =
      interfaceType === "voice"
        ? process.env.VOICE_MODEL_BACKUP || "gemini-2.5-flash-lite"
        : process.env.TEXT_MODEL_BACKUP || "gemini-2.5-flash-lite";

    let response;
    try {
      // 1. Attempt using primary model
      response = await ai.models.generateContent({
        model: mainModel,
        contents: contents,
        config: apiConfig,
      });
    } catch (primaryError) {
      if (mainModel === backupModel && interfaceType === "voice") {
        throw primaryError; // If voice is failing on its only model, just throw
      }
      if (mainModel === backupModel) {
        console.warn(
          `\n[⚠️ FALLBACK ALERT] ${mainModel} failed, but no alternate backup model is configured.`,
        );
        throw primaryError;
      }

      console.warn(
        `\n[⚠️ FALLBACK ALERT] ${mainModel} failed due to:`,
        primaryError.message,
      );
      console.warn(`Switching to fallback model (${backupModel})...\n`);

      // 2. Attempt using fallback model
      try {
        response = await ai.models.generateContent({
          model: backupModel,
          contents: contents,
          config: apiConfig,
        });
      } catch (secondaryError) {
        console.warn(
          `\n[⚠️ SECONDARY FALLBACK ALERT] ${backupModel} also failed due to:`,
          secondaryError.message,
        );
        console.warn(
          `Switching to ultimate fallback model (gemini-2.5-flash-lite)...\n`,
        );

        // 3. Attempt using ultimate fallback model (lightweight, highly available)
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: contents,
          config: apiConfig,
        });
      }
    }

    const resultText = response.text;
    const parsedData = JSON.parse(resultText);
    return parsedData;
  } catch (error) {
    console.error("\n================ GEMINI API ERROR ================");
    console.error("Time:", new Date().toISOString());
    console.error("UserInput:", userInput);
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    console.error(
      "Full Error Details:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );
    console.error("==================================================\n");
    return {
      patient_sentiment: "Unknown",
      escalation_alert: false,
      companion_reply:
        "I'm having a little trouble thinking right now. Please hold on a moment.",
    };
  }
}

/**
 * Text Interface Endpoint
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { text, sessionId } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    if (!sessionId)
      return res.status(400).json({ error: "Session ID is required" });

    const aiResponse = await getMindBridgeResponse(text, sessionId, "text");

    const logEntry = {
      id: Date.now().toString(),
      sessionId,
      timestamp: new Date(),
      type: "text",
      userText: text,
      ...aiResponse,
    };

    broadcastLog(logEntry);

    res.json(logEntry);
  } catch (err) {
    console.error("\n================ /API/CHAT ROUTE ERROR ================");
    console.error("Time:", new Date().toISOString());
    console.error("Error Message:", err.message);
    console.error("Error Stack:", err.stack);
    console.error(
      "=========================================================\n",
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Voice Interface Endpoint
 * Accepts an audio file upload, converts it to text, gets the AI response, hits TTS, and responds.
 */
app.post("/api/voice", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required" });
    }

    // 1. Send Audio to ElevenLabs STT
    const audioData = fs.readFileSync(req.file.path);
    const audioBlob = new Blob([audioData], { type: "audio/mp3" }); // assume mp3/m4a/webm depending on recorder
    const sttFormData = new FormData();
    sttFormData.append("file", audioBlob, "audio.webm");
    sttFormData.append("model_id", "scribe_v2"); // Updated STT model ID to Scribe v2
    sttFormData.append("language_code", "ara"); // Force Arabic STT

    let userText = "";
    try {
      const sttResponse = await axios.post(
        "https://api.elevenlabs.io/v1/speech-to-text",
        sttFormData,
        {
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
        },
      );
      userText = sttResponse.data.text || "Hello?";
    } catch (sttErr) {
      console.error("\n================ ELEVENLABS STT ERROR ================");
      console.error("Time:", new Date().toISOString());
      console.error("STT Error Message:", sttErr.message);
      console.error(
        "STT Error Response:",
        JSON.stringify(sttErr?.response?.data, null, 2),
      );
      console.error("======================================================\n");
      userText = "I couldn't hear you clearly, can you try again?";
    }

    // Clear uploaded file after reading
    fs.unlinkSync(req.file.path);

    // 2. Get AI Response (Set interfaceType = "voice" to map to correct ENV models)
    const sessionId = req.body.sessionId || "anonymous_session";
    const aiResponse = await getMindBridgeResponse(
      userText,
      sessionId,
      "voice",
    );

    const logEntry = {
      id: Date.now().toString(),
      sessionId,
      timestamp: new Date(),
      type: "voice",
      userText: userText,
      ...aiResponse,
    };
    broadcastLog(logEntry); // Instantly push AI interpretation to Dashboard before finishing slow TTS

    // 3. Stream TTS audio directly to the frontend for instant playback
    const HAMSA_VOICE_ID =
      process.env.HAMSA_VOICE_ID || "84c234d1-962d-4008-99f4-0d1b28b7e2c4";
    const ttsResponse = await axios.post(
      `https://api.tryhamsa.com/v1/jobs/text-to-speech`,
      {
        text: aiResponse.companion_reply,
        voice_id: HAMSA_VOICE_ID,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HAMSA_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream", // Retrieve binary audio chunk by chunk
      },
    );

    // Provide the JSON data in response headers so the frontend still gets the text/analytics
    res.setHeader("X-Log-Entry", encodeURIComponent(JSON.stringify(logEntry)));
    res.setHeader("Content-Type", "audio/mpeg");

    // Pipe the audio directly to the user
    ttsResponse.data.pipe(res);
  } catch (err) {
    console.error("\n================ /API/VOICE ROUTE ERROR ===============");
    console.error("Time:", new Date().toISOString());
    console.error("Error Message:", err.message);
    console.error("Error Stack:", err.stack);
    console.error(
      "Error Response Data:",
      JSON.stringify(err?.response?.data, null, 2),
    );
    console.error("=======================================================\n");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Dashboard Log Endpoints
 */
app.get("/api/logs", (req, res) => {
  res.json(interactionLogs);
});

/**
 * WebSocket endpoint for Real-Time STT and TTS streaming.
 * Implements full-duplex conversational voice bridging with ElevenLabs scribe_v2_realtime.
 */
wss.on("connection", (ws, req) => {
  if (req.url !== "/api/voice/stream") {
    return ws.close(); // Reject other paths
  }

  let elevenWs = null;
  let currentSessionId = "anonymous_session";
  let currentTranscript = "";

  console.log("[WSS] Client connected for Real-Time WebSocket stream.");

  ws.on("message", async (msg, isBinary) => {
    try {
      if (isBinary) {
        // Binary audio passing directly to ElevenLabs
        if (elevenWs && elevenWs.readyState === WebSocket.OPEN) {
          const base64Audio = msg.toString("base64");
          elevenWs.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: base64Audio,
              commit: false,
            }),
          );
        }
        return;
      }

      // Not binary, so it must be a JSON control message from the client
      const textMsg = msg.toString("utf8");
      const data = JSON.parse(textMsg);

      if (data.type === "start") {
        currentSessionId = data.sessionId || Date.now().toString();
        currentTranscript = "";

        console.log("[WSS] Opening ElevenLabs scribe_v2_realtime connection.");
        elevenWs = new WebSocket(
          "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&language_code=ara&sample_rate=16000",
          { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } },
        );

        elevenWs.on("open", () => {
          console.log("[ElevenLabs] Real-Time STT Connection Authorized.");
        });

        elevenWs.on("message", (elevenMsg) => {
          const sttData = JSON.parse(elevenMsg);
          if (
            sttData.message_type === "partial_transcript" ||
            sttData.message_type === "committed_transcript"
          ) {
            if (sttData.text) {
              currentTranscript = sttData.text;
              // Instantly stream transcribed words to UI
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: "stt_progress",
                    transcript: sttData.text,
                  }),
                );
              }
            }
          } else if (
            sttData.message_type === "error" ||
            sttData.message_type === "scribe_error"
          ) {
            console.error("[ElevenLabs WSS Error]", sttData);
          }
        });

        elevenWs.on("close", () => console.log("[ElevenLabs] STT WS Closed"));
        elevenWs.on("error", (err) =>
          console.error("[ElevenLabs] STT WS Error:", err),
        );
      } else if (data.type === "stop") {
        console.log("[WSS] Client finished talking. Resolving LLM and TTS...");
        if (elevenWs && elevenWs.readyState === WebSocket.OPEN) {
          // Close upstream cleanly
          elevenWs.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              commit: true,
              audio_base_64: "",
            }),
          );
          elevenWs.close();
        }

        if (!currentTranscript) currentTranscript = "Hello?";

        console.log(`\n================ STT RESULT ================`);
        console.log(`[User Said]: "${currentTranscript}"`);
        console.log(`============================================\n`);

        // Call our Gemini fallback models
        const aiResponse = await getMindBridgeResponse(
          currentTranscript,
          currentSessionId,
          "voice",
        );

        const logEntry = {
          id: Date.now().toString(),
          sessionId: currentSessionId,
          timestamp: new Date(),
          type: "voice",
          userText: currentTranscript,
          ...aiResponse,
        };
        broadcastLog(logEntry); // Trigger dashboard SSE

        // Send UI update
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ai_response", data: logEntry }));
        }

        // Trigger Hamsa low-latency TTS pipeline
        console.log("[WSS] Calling tryhamsa.com for TTS response...");
        const HAMSA_VOICE_ID =
          process.env.HAMSA_VOICE_ID || "84c234d1-962d-4008-99f4-0d1b28b7e2c4";
        const ttsResponse = await axios.post(
          `https://api.tryhamsa.com/v1/jobs/text-to-speech`,
          {
            text: aiResponse.companion_reply,
            voice_id: HAMSA_VOICE_ID,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.HAMSA_API_KEY}`,
              "Content-Type": "application/json",
            },
            responseType: "stream",
          },
        );

        // Pipe binary chunks back over the WebSocket to exactly match frontend playback
        ttsResponse.data.on("data", (chunk) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
        });

        ttsResponse.data.on("end", () => {
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "tts_done" }));
          console.log("[WSS] Finished sending TTS MP3 chunks via WebSocket.");
        });
      }
    } catch (err) {
      console.error("[WSS/AI Processing Error]", err.message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: `Failed pipeline: ${err.message}`,
          }),
        );
      }
    }
  });

  ws.on("close", () => {
    console.log("[WSS] Client Disconnected. Cleaning down nodes.");
    if (elevenWs && elevenWs.readyState === WebSocket.OPEN) elevenWs.close();
  });
});

// SSE endpoint for zero-latency dashboard updates
app.get("/api/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send an initial heartbeat
  res.write(": heartbeat\n\n");

  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
