const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const {
  ROLES,
  DB_FILE,
  createLog,
  createUser,
  deleteUser,
  getLogs,
  getLogsByPatientId,
  getUserById,
  getUsers,
} = require("./db");

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

const sseClients = new Set(); // For real-time Server-Sent Events
const RECORDINGS_DIR = path.join(__dirname, "recordings");
const STT_SAMPLE_RATE = 16000;
let mp3EncoderModulePromise = null;
let humeModulePromise = null;
let humeClient = null;

// Helper to broadcast a saved log to connected dashboards.
function broadcastLog(logEntry) {
  const payload = JSON.stringify(logEntry);
  for (const client of sseClients) {
    if (!client.patientId || client.patientId === logEntry.patientId) {
      client.res.write(`data: ${payload}\n\n`);
    }
  }
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, role: user.role };
}

function getRequester(req) {
  return getUserById(req.headers["x-user-id"]);
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const requester = getRequester(req);
    if (!requester || !allowedRoles.includes(requester.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.user = requester;
    next();
  };
}

function getPatientOrReject(patientId, res) {
  const patient = getUserById(patientId);
  if (!patient || patient.role !== ROLES.PATIENT) {
    res.status(404).json({ error: "Patient not found" });
    return null;
  }
  return patient;
}

function cleanupUpload(file) {
  if (file && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function ensurePatientRecordingDir(patientId) {
  const patientDir = path.join(RECORDINGS_DIR, patientId);
  fs.mkdirSync(patientDir, { recursive: true });
  return patientDir;
}

function getNextRecordingPath(patientId) {
  const patientDir = ensurePatientRecordingDir(patientId);
  const existingCount = fs
    .readdirSync(patientDir)
    .filter((fileName) => fileName.endsWith(".mp3")).length;
  const recordingNumber = String(existingCount + 1).padStart(3, "0");
  return path.join(patientDir, `${patientId}-${recordingNumber}.mp3`);
}

async function getMp3EncoderModule() {
  if (!mp3EncoderModulePromise) {
    mp3EncoderModulePromise = import("@breezystack/lamejs");
  }
  return mp3EncoderModulePromise;
}

async function encodePcm16ToMp3(pcmBuffer) {
  const { Mp3Encoder } = await getMp3EncoderModule();
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const samples = new Int16Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = pcmBuffer.readInt16LE(index * 2);
  }

  const encoder = new Mp3Encoder(1, STT_SAMPLE_RATE, 64);
  const mp3Chunks = [];
  const blockSize = 1152;

  for (let offset = 0; offset < samples.length; offset += blockSize) {
    const sampleChunk = samples.subarray(offset, offset + blockSize);
    const mp3Buffer = encoder.encodeBuffer(sampleChunk);
    if (mp3Buffer.length > 0) {
      mp3Chunks.push(Buffer.from(mp3Buffer));
    }
  }

  const finalBuffer = encoder.flush();
  if (finalBuffer.length > 0) {
    mp3Chunks.push(Buffer.from(finalBuffer));
  }

  return Buffer.concat(mp3Chunks);
}

async function saveRealtimeSttRecording(patientId, pcmChunks) {
  if (!patientId || pcmChunks.length === 0) return null;

  const pcmBuffer = Buffer.concat(pcmChunks);
  const mp3Buffer = await encodePcm16ToMp3(pcmBuffer);
  const recordingPath = getNextRecordingPath(patientId);

  fs.writeFileSync(recordingPath, mp3Buffer);
  console.log(`[Recordings] Saved STT audio: ${recordingPath}`);
  return recordingPath;
}

function saveUploadedSttRecording(patientId, audioData) {
  if (!patientId || !audioData?.length) return null;

  const recordingPath = getNextRecordingPath(patientId);
  fs.writeFileSync(recordingPath, audioData);
  console.log(`[Recordings] Saved uploaded STT audio: ${recordingPath}`);
  return recordingPath;
}

async function getHumeClient() {
  if (!process.env.HUME_API_KEY) return null;

  if (!humeClient) {
    if (!humeModulePromise) {
      humeModulePromise = import("hume");
    }
    const { HumeClient } = await humeModulePromise;
    humeClient = new HumeClient({ apiKey: process.env.HUME_API_KEY });
  }

  return humeClient;
}

function collectProsodyPredictions(result) {
  const directPredictions = result?.prosody?.predictions;
  if (Array.isArray(directPredictions)) return directPredictions;

  const groupedPredictions =
    result?.prosody?.groupedPredictions || result?.prosody?.grouped_predictions;
  if (Array.isArray(groupedPredictions)) {
    return groupedPredictions.flatMap((group) => group.predictions || []);
  }

  return [];
}

function summarizeHumeExpressions(predictions) {
  const expressionTotals = new Map();

  for (const prediction of predictions) {
    for (const emotion of prediction.emotions || []) {
      const current = expressionTotals.get(emotion.name) || {
        name: emotion.name,
        total: 0,
        count: 0,
      };
      current.total += Number(emotion.score) || 0;
      current.count += 1;
      expressionTotals.set(emotion.name, current);
    }
  }

  const voiceExpressions = Array.from(expressionTotals.values())
    .map((expression) => ({
      name: expression.name,
      score: Number((expression.total / expression.count).toFixed(3)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    voice_expressions: voiceExpressions,
    voice_expression_summary: voiceExpressions
      .slice(0, 3)
      .map((expression) => expression.name)
      .join(", "),
  };
}

async function analyzeVoiceExpressions(recordingPath) {
  if (!recordingPath) return {};

  const client = await getHumeClient();
  if (!client) {
    return {
      voice_expression_error: "HUME_API_KEY is not configured",
    };
  }

  try {
    const socket = await client.expressionMeasurement.stream.connect({
      config: { prosody: {} },
    });

    try {
      const result = await socket.sendFile({
        file: fs.createReadStream(recordingPath),
      });
      const predictions = collectProsodyPredictions(result);
      return summarizeHumeExpressions(predictions);
    } finally {
      socket.close();
    }
  } catch (error) {
    console.error("[Hume] Voice expression analysis failed:", error.message);
    return {
      voice_expression_error: error.message,
    };
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
 * @param {string} patientId
 * @param {string} interfaceType - "text" or "voice" to determine which models to use
 * @returns {Promise<Object>} The parsed JSON
 */
async function getMindBridgeResponse(
  userInput,
  patientId,
  interfaceType = "text",
  language = "EN",
) {
  try {
    // Build conversation history from interaction logs (last 4 turns for context - optimized for latency)
    const recentLogs = getLogsByPatientId(patientId).slice(0, 4).reverse();
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

    let finalSystemPrompt = SYSTEM_PROMPT;
    if (interfaceType === "voice") {
      if (language === "AR") {
        finalSystemPrompt +=
          "\n\n[CRITICAL RULE FOR THIS SESSION]: YOU MUST ONLY LISTEN TO AND RESPOND IN ARABIC (SAUDI NAJDI DIALECT). ABSOLUTELY NO ENGLISH. YOU WILL ONLY RESPOND IN ARABIC.";
      } else {
        finalSystemPrompt +=
          "\n\n[CRITICAL RULE FOR THIS SESSION]: YOU MUST ONLY LISTEN TO AND RESPOND IN ENGLISH. Use a warm, calming, human-like conversational tone. ABSOLUTELY NO ARABIC. YOU WILL ONLY RESPOND IN ENGLISH.";
      }
    } else {
      if (language === "AR") {
        finalSystemPrompt +=
          "\n\n[LANGUAGE PREFERENCE]: The user prefers Arabic (Saudi Najdi Dialect). Respond in Arabic unless they switch to English.";
      } else {
        finalSystemPrompt +=
          "\n\n[LANGUAGE PREFERENCE]: The user prefers English. Respond in English unless they switch to Arabic.";
      }
    }

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
 * ID-based authentication and RBAC endpoints.
 */
app.post("/api/auth/login", (req, res) => {
  const { id } = req.body;
  const user = getUserById(String(id || "").trim());

  if (!user) {
    return res.status(404).json({
      error: "Account not found. Please contact the administrator.",
    });
  }

  res.json(publicUser(user));
});

app.post("/api/admin/users", requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const { id, name, role } = req.body;
    const normalizedRole = String(role || "").toUpperCase();

    if (![ROLES.DOCTOR, ROLES.PATIENT].includes(normalizedRole)) {
      return res.status(400).json({ error: "Role must be DOCTOR or PATIENT" });
    }

    const user = createUser({ id, name, role: normalizedRole });
    res.status(201).json(publicUser(user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/admin/users", requireRole(ROLES.ADMIN), (req, res) => {
  res.json(getUsers().map(publicUser));
});

app.delete("/api/admin/users/:id", requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const deletedUser = deleteUser(req.params.id);
    res.json({
      deleted: publicUser(deletedUser),
      message:
        deletedUser.role === ROLES.PATIENT
          ? "Patient and patient logs deleted"
          : "User deleted",
    });
  } catch (err) {
    const status = err.message === "User not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

app.get("/api/users/patients", requireRole(ROLES.ADMIN, ROLES.DOCTOR), (req, res) => {
  res.json(getUsers().filter((user) => user.role === ROLES.PATIENT).map(publicUser));
});

app.get("/api/logs/patient/:id", (req, res) => {
  const requester = getRequester(req);
  const patientId = req.params.id;

  if (!requester) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (
    ![ROLES.ADMIN, ROLES.DOCTOR].includes(requester.role) &&
    requester.id !== patientId
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!getPatientOrReject(patientId, res)) return;

  res.json(getLogsByPatientId(patientId));
});

app.get("/api/db/schema", requireRole(ROLES.ADMIN), (req, res) => {
  res.json({
    file: DB_FILE,
    entities: {
      User: {
        id: "10-digit numeric string",
        name: "String",
        role: "ADMIN | DOCTOR | PATIENT",
      },
      Log: {
        id: "String/UUID",
        patientId: "Foreign Key -> User.id",
        timestamp: "ISO Date String",
        type: "text | voice",
        userText: "String",
        companion_reply: "String",
        patient_sentiment: "String",
        crisis_risk_level: "Low | Medium | High",
        escalation_alert: "Boolean",
        clinical_summary: "String",
        voice_expressions: "Array<{ name: String, score: Number }>",
        voice_expression_summary: "String",
        voice_expression_error: "String",
      },
    },
    constraints: {
      userId: "Admin assigns an exactly 10-digit numeric ID. IDs must be unique.",
    },
  });
});

/**
 * Text Interface Endpoint
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { text, patientId, language } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    if (!patientId)
      return res.status(400).json({ error: "Patient ID is required" });
    if (!getPatientOrReject(patientId, res)) return;

    const aiResponse = await getMindBridgeResponse(
      text,
      patientId,
      "text",
      language || "EN",
    );

    const logEntry = createLog({
      patientId,
      type: "text",
      userText: text,
      ...aiResponse,
    });

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
    const patientId = req.body.patientId;
    if (!patientId) {
      cleanupUpload(req.file);
      return res.status(400).json({ error: "Patient ID is required" });
    }
    if (!getPatientOrReject(patientId, res)) {
      cleanupUpload(req.file);
      return;
    }

    let userText = "";
    let recordingPath = null;

    try {
      const audioData = fs.readFileSync(req.file.path);
      recordingPath = saveUploadedSttRecording(patientId, audioData);
      const audioBlob = new Blob([audioData], { type: "audio/mp3" });
      const sttFormData = new FormData();
      sttFormData.append("file", audioBlob, "audio.webm");
      const voiceLang = req.body.language || "EN";
      sttFormData.append("model_id", "scribe_v2");
      sttFormData.append("language_code", voiceLang === "AR" ? "ara" : "eng");

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
    } finally {
      // GUARANTEED CLEANUP: Prevents server storage exhaustion
      cleanupUpload(req.file);
    }

    const voiceLang = req.body.language || "EN";
    const aiResponse = await getMindBridgeResponse(
      userText,
      patientId,
      "voice",
      voiceLang,
    );
    const voiceExpressionData = await analyzeVoiceExpressions(recordingPath);

    const logEntry = createLog({
      patientId,
      type: "voice",
      userText: userText,
      ...aiResponse,
      ...voiceExpressionData,
    });
    broadcastLog(logEntry);

    res.setHeader("X-Log-Entry", encodeURIComponent(JSON.stringify(logEntry)));
    res.setHeader("Content-Type", "audio/mpeg");

    let HAMSA_VOICE_ID =
      process.env.HAMSA_VOICE_ID || "84c234d1-962d-4008-99f4-0d1b28b7e2c4";
    if (req.body.voice === "female" && process.env.HAMSA_FEMALE_VOICE_ID) {
      HAMSA_VOICE_ID = process.env.HAMSA_FEMALE_VOICE_ID;
    }

    const ttsResponse = await axios.post(
      `https://api.tryhamsa.com/v1/jobs/text-to-speech`,
      { text: aiResponse.companion_reply, voiceId: HAMSA_VOICE_ID },
      {
        headers: {
          Authorization: `Token ${process.env.HAMSA_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (ttsResponse.data?.data?.mediaUrl) {
      const audioStreamResponse = await axios.get(
        ttsResponse.data.data.mediaUrl,
        {
          responseType: "stream",
        },
      );
      audioStreamResponse.data.pipe(res);
    } else {
      res.status(500).json({ error: "Failed to generate Hamsa TTS" });
    }
  } catch (err) {
    console.error("\n================ /API/VOICE ROUTE ERROR ===============");
    console.error("Error Message:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
/**
 * Dashboard Log Endpoints
 */
app.get("/api/logs", (req, res) => {
  const requester = getRequester(req);
  if (!requester || ![ROLES.ADMIN, ROLES.DOCTOR].includes(requester.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(getLogs());
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
  let elevenAudioBuffer = [];
  let currentPatientId = null;
  let currentTranscript = "";
  let currentVoicePref = "female";
  let currentLanguage = "EN";
  let currentRecordingChunks = [];

  console.log("[WSS] Client connected for Real-Time WebSocket stream.");

  ws.on("message", async (msg, isBinary) => {
    try {
      if (isBinary) {
        // Binary audio passing directly to ElevenLabs
        if (elevenWs) {
          currentRecordingChunks.push(Buffer.from(msg));
          const base64Audio = msg.toString("base64");
          const chunkMsg = JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: base64Audio,
            commit: false,
          });

          if (elevenWs.readyState === WebSocket.OPEN) {
            elevenWs.send(chunkMsg);
          } else if (elevenWs.readyState === WebSocket.CONNECTING) {
            elevenAudioBuffer.push(chunkMsg);
          }
        }
        return;
      }

      // Not binary, so it must be a JSON control message from the client
      const textMsg = msg.toString("utf8");
      const data = JSON.parse(textMsg);

      if (data.type === "start") {
        if (elevenWs && elevenWs.readyState === WebSocket.OPEN) {
          elevenWs.close();
        }
        currentPatientId = data.patientId || null;
        const patient = getUserById(currentPatientId);
        if (!currentPatientId || !patient || patient.role !== ROLES.PATIENT) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "A valid patient ID is required for voice streaming.",
            }),
          );
          return;
        }
        currentTranscript = "";
        currentVoicePref = data.voice || "female";
        currentLanguage = data.language || "EN";
        elevenAudioBuffer = [];
        currentRecordingChunks = [];

        const sttLangCode = currentLanguage === "AR" ? "ara" : "eng";
        console.log(
          `[WSS] Opening ElevenLabs scribe_v2_realtime (lang: ${sttLangCode}).`,
        );
        elevenWs = new WebSocket(
          `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&language_code=${sttLangCode}&sample_rate=16000`,
          { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } },
        );

        elevenWs.on("open", () => {
          console.log("[ElevenLabs] Real-Time STT Connection Authorized.");
          while (elevenAudioBuffer.length > 0) {
            elevenWs.send(elevenAudioBuffer.shift());
          }
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

        let recordingPath = null;
        try {
          recordingPath = await saveRealtimeSttRecording(
            currentPatientId,
            currentRecordingChunks,
          );
        } catch (recordingErr) {
          console.error("[Recordings] Failed to save STT audio:", recordingErr.message);
        }

        if (!currentTranscript) currentTranscript = "Hello?";

        console.log(`\n================ STT RESULT ================`);
        console.log(`[User Said]: "${currentTranscript}"`);
        console.log(`============================================\n`);

        const aiResponse = await getMindBridgeResponse(
          currentTranscript,
          currentPatientId,
          "voice",
          currentLanguage,
        );
        const voiceExpressionData = await analyzeVoiceExpressions(recordingPath);

        const logEntry = createLog({
          patientId: currentPatientId,
          type: "voice",
          userText: currentTranscript,
          ...aiResponse,
          ...voiceExpressionData,
        });
        broadcastLog(logEntry); // Trigger dashboard SSE

        // Send UI update
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ai_response", data: logEntry }));
        }

        console.log("[WSS] Calling tryhamsa.com for TTS...");
        let HAMSA_VOICE_ID =
          process.env.HAMSA_VOICE_ID || "84c234d1-962d-4008-99f4-0d1b28b7e2c4";
        if (
          currentVoicePref === "female" &&
          process.env.HAMSA_FEMALE_VOICE_ID
        ) {
          HAMSA_VOICE_ID = process.env.HAMSA_FEMALE_VOICE_ID;
        }

        const ttsResponse = await axios.post(
          `https://api.tryhamsa.com/v1/jobs/text-to-speech`,
          { text: aiResponse.companion_reply, voiceId: HAMSA_VOICE_ID },
          {
            headers: {
              Authorization: `Token ${process.env.HAMSA_API_KEY}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (ttsResponse.data?.data?.mediaUrl) {
          const audioUrl = ttsResponse.data.data.mediaUrl;
          console.log("[WSS] Hamsa TTS ready at URL:", audioUrl);
          const audioStreamResponse = await axios.get(audioUrl, {
            responseType: "stream",
          });

          audioStreamResponse.data.on("data", (chunk) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
          });
          audioStreamResponse.data.on("end", () => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: "tts_done" }));
            console.log("[WSS] Finished sending Hamsa TTS chunks.");
          });
        } else {
          throw new Error("Invalid response from Hamsa TTS API");
        }
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
  const patientId = req.query.patientId ? String(req.query.patientId) : null;
  const requester = getUserById(req.query.userId);

  if (
    patientId &&
    (!requester ||
      (![ROLES.ADMIN, ROLES.DOCTOR].includes(requester.role) &&
        requester.id !== patientId))
  ) {
    return res.status(403).end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send an initial heartbeat
  res.write(": heartbeat\n\n");

  const client = { res, patientId };
  sseClients.add(client);

  req.on("close", () => {
    sseClients.delete(client);
  });
});

server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
