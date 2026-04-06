# MindBridge 🧠🌉

MindBridge is an intelligent, empathetic digital emotional support system designed for hospitalized patients. Healthcare systems face critical nursing shortages, creating an "emotional support gap" that increases patient anxiety. MindBridge acts as a compassionate "Digital Sedation" tool, delivering continuous reassurance using Cognitive Behavioral Therapy (CBT) and Acceptance and Commitment Therapy (ACT) principles.

**Strict Guardrails:** MindBridge is NOT a doctor. It provides no medical advice. If a patient mentions pain or has medical questions, it gently redirects them to human medical staff while silently flagging the dashboard for immediate clinical intervention.

## 🚀 Features

1. **Voice-to-Voice Interface (Patient):** A minimalist, calming UI that allows patients to simply tap to talk. It perfectly replicates a supportive companion voice, understanding intent, sentiment, and returning human-like text-to-speech audio.
2. **Text-to-Text Interface (Patient):** A clean, familiar chat interface for patients who prefer typing or are unable to speak aloud.
3. **Medical Staff Dashboard:** A localized, real-time monitoring dashboard pulling Live Patient Logs. Staff can instantly see the patient's sentiment (e.g., Anxious, Calm, Frustrated) and immediately spot high-priority **Escalation Alerts** if medical or pain-related issues arise.

## 🛠️ Tech Stack

- **Frontend:** React.js, Vite, Tailwind CSS v4, React Router, Lucide React
- **Backend:** Node.js, Express, Axios, Multer
- **AI & LLM:** Google Gemini 2.5 Flash API (Prompted strictly for JSON output)
- **Audio Processing:** ElevenLabs STT (Speech-to-Text) and TTS (Text-to-Speech) APIs

## 📦 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)
- An [ElevenLabs API Key](https://elevenlabs.io/)

### 1. Backend Setup

Navigate to the `backend` directory and install the required dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder and insert your keys:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
```

Start the backend server:

```bash
node index.js
```

_(The backend will now be running on http://localhost:5000)_

### 2. Frontend Setup

Open a **new** terminal, navigate to the `frontend` directory, and install dependencies:

```bash
cd frontend
npm install
```

Start the Vite development server:

```bash
npm run dev
```

_(The UI will now be available on http://localhost:5173)_

## 🔧 How to Test the Prototype

1. Open `http://localhost:5173/` in your browser.
2. The default landing page provides the **Voice Interface** (`/voice`). Make sure your microphone is enabled.
3. Use the navigation bar to try the **Text Chat** (`/text`).
4. Open the **Doctor Dashboard** (`/dashboard`) in a separate browser tab.
   - **Pro-tip:** Try typing _"My stomach is really hurting right now"_ in the Text Chat. Then quickly check the Dashboard—you will see Gemini correctly identifying the intention, remaining empathetic to the patient, and triggering a high-priority red **Escalation Needed** alert for the medical staff!
