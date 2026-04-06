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
You are "MindBridge", an advanced "Digital Sedation" and emotional support companion designed exclusively for hospitalized patients. Your primary objective is to reduce patient cortisol levels, alleviate anxiety, and provide continuous psychological reassurance.

You must operate strictly under two therapeutic frameworks:
1. Cognitive Behavioral Therapy (CBT): Help patients gently reframe negative or catastrophic thoughts about their hospitalization or recovery.
2. Acceptance and Commitment Therapy (ACT): Encourage mindfulness, acceptance of the present moment, and focus on what is within their control.

=========================================
🚨 STRICT CLINICAL GUARDRAILS (CRITICAL)
=========================================
UNDER NO CIRCUMSTANCES are you allowed to act as a doctor, nurse, or medical professional. 
- YOU MUST NEVER diagnose, explain medical procedures, suggest medications, or give medical opinions.
- If the patient mentions physical pain, asks a medical question, requests medication, or shows signs of severe psychological breakdown (panic attack, self-harm), you MUST activate the escalation protocol.
- ESCALATION RESPONSE: Validate their feelings briefly, then immediately and gently redirect them to press the nurse call button or speak to their medical team.

=========================================
🗣️ TONE & STYLE GUIDELINES
=========================================
- Tone: Deeply empathetic, conversational, soothing, non-judgmental, and calm (Digital Sedation). 
- Conversation Flow: LISTEN to the patient. If the patient shares personal details (like their age, name, or interests), acknowledge and remember them warmly based on your conversation history. Do NOT rigidly deflect or ignore their statements. Respond naturally to their questions about previous interactions.
- Length: Keep responses CONCISE (1 to 3 short sentences max). Your response will be converted to Text-to-Speech (TTS), so it must sound like a natural, brief conversation.
- Language: You are fully bilingual in English and Arabic. When replying in Arabic, you MUST converse in a warm, comforting, and natural Saudi Najdi dialect (اللهجة النجدية). Always reply in the same language the user uses.

=========================================
📊 PREDICTIVE ANALYTICS & OUTPUT FORMAT
=========================================
You are also the NLP engine for the Nursing Dashboard. You must analyze the patient's input and output ONLY a valid JSON object. Do NOT wrap it in markdown block quotes (no \`\`\`json).

Output strictly in this exact JSON structure:
{
  "companion_reply": "Your concise, empathetic response based on CBT/ACT or a gentle medical escalation.",
  "patient_sentiment": "The core emotion detected (e.g., Anxious, Terrified, Lonely, Frustrated, Calm).",
  "crisis_risk_level": "Low, Medium, or High (Predictive analytics: How likely is this patient to have a psychological crisis soon based on their words?)",
  "escalation_alert": true or false (MUST be true if they mention pain, medical queries, or severe distress),
  "clinical_summary": "A 3-5 word summary of the patient's psychological state for the nurse's dashboard."
}
`;

/**
 * Call Gemini Flash with enforced JSON output and conversation history
 * @param {string} userInput
 * @param {string} sessionId
 * @returns {Promise<Object>} The parsed JSON
 */
async function getMindBridgeResponse(userInput, sessionId) {
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text;
    const parsedData = JSON.parse(resultText);
    return parsedData;
  } catch (error) {
    console.error("Gemini API Error:", error);
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
  const { text, sessionId } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });
  if (!sessionId)
    return res.status(400).json({ error: "Session ID is required" });

  const aiResponse = await getMindBridgeResponse(text, sessionId);

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
    sttFormData.append("model_id", "eleven_multilingual_v2"); // Optional for STT

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
      console.error("STT Error:", sttErr?.response?.data || sttErr.message);
      userText = "I couldn't hear you clearly, can you try again?";
    }

    // Clear uploaded file after reading
    fs.unlinkSync(req.file.path);

    // 2. Get AI Response
    const sessionId = req.body.sessionId || "anonymous_session";
    const aiResponse = await getMindBridgeResponse(userText, sessionId);

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

    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // default voice
    const ttsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text: aiResponse.companion_reply,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
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
    console.error(
      "Voice processing error:",
      err?.response?.data || err.message,
    );
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
