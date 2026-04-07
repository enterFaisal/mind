require("dotenv").config();
const axios = require("axios");
const fs = require("fs");

async function testElevenLabs() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  // Use the ID from .env, or the reliable default we just set
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const textToSpeak =
    "Hello! This is a test to verify the ElevenLabs API is working correctly.";

  if (!apiKey) {
    console.error(
      "❌ ERROR: ELEVENLABS_API_KEY is not defined in your .env file.",
    );
    return;
  }

  console.log("🎙️ Testing ElevenLabs API...");
  console.log(`- Voice ID: ${voiceId}`);
  console.log(`- Model: eleven_turbo_v2_5`);
  console.log(`- Text to speak: "${textToSpeak}"`);
  console.log("Waiting for response...\n");

  try {
    const ttsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: textToSpeak,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer", // Important! Tells Axios we want binary audio data back
      },
    );

    // Save the audio to a file
    const outputFilename = "test-output.mp3";
    fs.writeFileSync(outputFilename, ttsResponse.data);

    console.log(`✅ SUCCESS! The API responded perfectly.`);
    console.log(`🎵 Audio file saved to: ${outputFilename}`);
    console.log(
      `Open the folder and play '${outputFilename}' to hear the result.`,
    );
  } catch (error) {
    console.error("❌ ELEVENLABS API REQUEST FAILED!");

    if (error.response) {
      console.error(`HTTP Status Code: ${error.response.status}`);

      // Because we requested 'arraybuffer', the error data from the API comes back in binary.
      // We have to convert it back to a readable string/JSON to see the true error message.
      if (Buffer.isBuffer(error.response.data)) {
        try {
          const jsonError = JSON.parse(error.response.data.toString("utf8"));
          console.error("Error Detail:", JSON.stringify(jsonError, null, 2));
        } catch {
          console.error(
            "Raw Error Data:",
            error.response.data.toString("utf8"),
          );
        }
      } else {
        console.error("Error Data:", error.response.data);
      }
    } else {
      console.error("Error Message:", error.message);
    }
  }
}

testElevenLabs();
