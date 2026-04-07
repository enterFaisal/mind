const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Gemini Client
// We use the new @google/genai SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Audio Upload Middleware
const upload = multer({ dest: "uploads/" });

// In-Memory Storage for prototype data
// Shape: { id: string, sessionId: string, timestamp: Date, type: 'text' | 'voice', userText: string, companionReply: string, sentiment: string, escalationAlert: boolean, clinicalSummary: string }
const interactionLogs = [];

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
    // Build conversation history from interaction logs (last 10 turns for context)
    const recentLogs = interactionLogs
      .filter((log) => log.sessionId === sessionId)
      .slice(-10);
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

    const apiConfig = {
      systemInstruction: SYSTEM_PROMPT,
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

    interactionLogs.push(logEntry);

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
    sttFormData.append("model_id", "scribe_v2_realtime"); // Updated STT model ID to Scribe v2

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
    interactionLogs.push(logEntry);

    // 3. Return the JSON payload
    // Note: The frontend will do a separate TTS call or we can hit TTS here.
    // If we want to hide API keys, we MUST hit TTS here and either stream it or return it.
    // Let's get the TTS audio as a base64 string or an arrayBuffer and send it to the client.

    // Using a default Voice ID that is guaranteed to be available on free tiers (Rachel)
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const ttsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text: aiResponse.companion_reply,
        model_id: "eleven_turbo_v2_5", // Use turbo v2.5 for low latency
        voice_settings: {
          stability: 0.8,
          similarity_boost: 0.75,
          speed: 1.09,
        },
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      },
    );

    const audioBase64 = Buffer.from(ttsResponse.data, "binary").toString(
      "base64",
    );

    // Send the combined response
    res.json({
      ...logEntry,
      audioBase64: `data:audio/mp3;base64,${audioBase64}`,
    });
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
 * Dashboard Log Endpoint
 */
app.get("/api/logs", (req, res) => {
  res.json(interactionLogs);
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
