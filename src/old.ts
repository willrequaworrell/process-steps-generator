import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import extract from 'ffmpeg-extract-frames';
import { generateObject } from 'ai';
// Import the factory function instead of the default instance
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

// Create a custom provider instance that reads the API key from process.env
console.log(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
const google = createGoogleGenerativeAI({
  apiKey: "AIzaSyBwLYlWj58dPX1NduBeTr4cphbnNL3Z_V0",
});



// Command line arguments
const VIDEO: string | undefined = process.argv[2];
const TRANSCRIPT: string | undefined = process.argv[3];

if (!VIDEO || !TRANSCRIPT) {
  console.error('Usage: ts-node process-AISDK.ts <video.mp4> <transcript.txt>');
  process.exit(1);
}

// Configuration
const FPS: number = 1;
const FRAMES_DIR: string = './frames';

// 1. Extract frames
fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
fs.mkdirSync(FRAMES_DIR);

await extract({
  input: VIDEO,
  output: path.join(FRAMES_DIR, 'frame-%05d.png'),
  fps: FPS,
  ffmpegPath: ffmpegInstaller.path
});

const frameFiles: string[] = fs.readdirSync(FRAMES_DIR)
  .filter((f: string): boolean => f.endsWith('.png'))
  .map((f: string): string => path.join(FRAMES_DIR, f));

// 2. Load transcript
const transcriptText: string = fs.readFileSync(TRANSCRIPT, 'utf8');

// 3. Prepare message parts
const contentParts: Array<{ type: 'file'; mimeType: string; data: Buffer; } | { type: 'text'; text: string; }> = [];

for (const filePath of frameFiles) {
  contentParts.push({ type: 'file', mimeType: 'image/png', data: fs.readFileSync(filePath) });
}
contentParts.push({ type: 'text', text: `Transcript: ${transcriptText}` });

// 4. Define Zod schema
const SubStep = z.object({ step: z.string(), numbering: z.string(), time_stamp: z.string() });
const Step = z.object({ group_name: z.string(), numbering: z.string(), time_stamp: z.string(), sub_steps: z.array(SubStep) });
const ProcessSchema = z.object({ process_name: z.string(), short_process_description: z.string(), list_of_steps: z.array(Step) });

// 5. Call Gemini Vision + NLP using the custom provider instance
const { object: result } = await generateObject({
  model: google('gemini-2.5-pro-vision'), // This now uses your custom instance
  schema: ProcessSchema,
  system: `You are a senior Business Analyst. From the sequential screenshots and transcript provided, output ONLY valid JSON (no markdown, no additional text) in this format matching the Zod schema. The screenshots show a business process step-by-step. Use the provided transcript for additional context about what's happening in each screenshot.`,
  messages: [{ role: 'user', content: contentParts }],
});

// 6. Write JSON to file
const outputPath: string = 'process_steps.json';
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log('✅ process_steps.json generated');
