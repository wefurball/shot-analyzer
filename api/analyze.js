export const config = {
  api: {
    bodyParser: false,
  },
};

import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import nextConnect from "next-connect";
import fs from "fs";

const upload = multer({ dest: "/tmp" });
const handler = nextConnect();

handler.use(upload.single("video"));

handler.post(async (req, res) => {
  try {
    const apiKey = req.body.apiKey;
    const prompt = req.body.prompt;

    if (!apiKey) throw new Error("Missing API key");
    if (!req.file) throw new Error("No video uploaded");

    const ai = new GoogleGenAI({ apiKey });

    const uploaded = await ai.files.upload({
      file: req.file.path,
      config: {
        mimeType: req.file.mimetype,
        displayName: req.file.originalname,
      },
    });

    let file = uploaded;

    while (file.state === "PROCESSING") {
      await new Promise(r => setTimeout(r, 3000));
      file = await ai.files.get({ name: file.name });
    }

    if (file.state !== "ACTIVE") {
      throw new Error("Video processing failed");
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              fileData: {
                mimeType: req.file.mimetype,
                fileUri: file.uri,
              },
            },
          ],
        },
      ],
    });

    fs.unlinkSync(req.file.path);

    res.status(200).json({ text: response.text });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default handler;
