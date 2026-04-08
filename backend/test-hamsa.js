const axios = require("axios");
const fs = require("fs");

// Using the keys you provided
const HAMSA_API_KEY = "86ccd371-39eb-48dc-b336-85f414b30646";
const HAMSA_VOICE_ID = "84c234d1-962d-4008-99f4-0d1b28b7e2c4";

async function testHamsaTTS() {
  try {
    console.log("1. Sending Text-to-Speech request to Hamsa API...");

    const ttsResponse = await axios.post(
      "https://api.tryhamsa.com/v1/jobs/text-to-speech",
      {
        text: "مرحباً بكم في نظام مايند بريدج، أنا هنا لسماعك ودعمك. كيف حالك اليوم؟",
        voiceId: HAMSA_VOICE_ID,
      },
      {
        headers: {
          Authorization: `Token ${HAMSA_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (
      ttsResponse.data &&
      ttsResponse.data.data &&
      ttsResponse.data.data.mediaUrl
    ) {
      const audioUrl = ttsResponse.data.data.mediaUrl;
      console.log("2. Success! Hamsa generated the audio.");
      console.log("   -> Media URL:", audioUrl);

      console.log("3. Downloading the audio file to your computer...");
      const audioStreamResponse = await axios.get(audioUrl, {
        responseType: "stream",
      });

      // Save it locally to verify the audio plays correctly
      const writer = fs.createWriteStream("hamsa-test.wav");
      audioStreamResponse.data.pipe(writer);

      writer.on("finish", () => {
        console.log(
          "4. 🎉 Done! Audio saved successfully as 'hamsa-test.wav'.",
        );
        console.log(
          "   -> Go ahead and play the file to verify the voice quality!",
        );
      });

      writer.on("error", (err) => {
        console.error("Error writing the audio file:", err);
      });
    } else {
      console.log(
        "Error: Expected mediaUrl, but got something else:",
        ttsResponse.data,
      );
    }
  } catch (error) {
    console.error("❌ Error testing Hamsa API:");
    if (error.response) {
      console.error(
        `Status ${error.response.status}:`,
        JSON.stringify(error.response.data, null, 2),
      );
    } else {
      console.error(error.message);
    }
  }
}

testHamsaTTS();
