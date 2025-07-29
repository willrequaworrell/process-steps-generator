// src/process-with-thumbs.ts
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {
  GoogleGenAI,
  Type,
  createPartFromUri,
  createUserContent,
} from '@google/genai';
import { ProcessDocument, Step, SubStep } from './types/index.js';
import { generateWordDocument } from './generateDocument.js';

// If you create a document generator, you would import it here.
// import { generateWordDocument } from './generateDocument.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Extracts a single frame from the video at a specific timestamp.
 */
function extractFrame(
  videoPath: string,
  timestamp: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x?', // High-quality thumbnails
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

async function main(): Promise<void> {
  const [videoPath, transcriptPath] = process.argv.slice(2);
  if (!videoPath || !transcriptPath) {
    console.error('Usage: npm start <video.mp4> <transcript.txt>');
    process.exit(1);
  }

  // 1. Initialize the AI client using the API key from your .env file
  const ai = new GoogleGenAI({ apiKey: "AIzaSyAgwonle5gLHByu_jJhM8FK0M8HJZpxt1o" });

  // 2. Upload the video and poll until it's processed and ready
  console.log(`Uploading ${videoPath}...`);
  const uploaded = await ai.files.upload({
    file: videoPath,
    config: { mimeType: 'video/mp4' },
  });
  let file = await ai.files.get({ name: uploaded.name });
  while (file.state !== 'ACTIVE') {
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 3000));
    file = await ai.files.get({ name: uploaded.name });
  }
  console.log('\nFile is ACTIVE');

  // 3. Read the transcript file
  const transcript = await fs.readFile(transcriptPath, 'utf8');

  // 4. Call the AI with the rich, self-documenting schema
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Use a powerful model for the best results
    contents: createUserContent([
      createPartFromUri(file.uri, file.mimeType),
      `TRANSCRIPT:\n${transcript}`,
      // A simple, direct prompt that points the AI to the schema for instructions.
      'You are a senior Business Analyst. Extract the process into the JSON format defined by the schema.',
    ]),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        description: "A Process Definition Document (PDD) structure.",
        properties: {
          process_name: { type: Type.STRING, description: "The official name of the business process." },
          short_process_description: {
            type: Type.STRING,
            description: "A concise, 1-2 sentence summary of the process goal.",
            maxLength: 300,
          },
          list_of_applications: {
            type: Type.ARRAY,
            description: "A list of all software applications used in the video.",
            items: {
              type: Type.OBJECT,
              properties: {
                application_name: { type: Type.STRING, description: "Name of the application, e.g., 'Microsoft Excel'." },
                type: { type: Type.STRING, description: "Type of application, e.g., 'Desktop Application' or 'Web Application'." },
                url: { type: Type.STRING, description: "URL or file path, if applicable." },
              },
            },
          },
          list_of_steps: {
            type: Type.ARRAY,
            description: "An ordered list of the high-level steps in the process.",
            items: {
              type: Type.OBJECT,
              properties: {
                group_name: { type: Type.STRING, description: "A name for a logical group of actions, e.g., 'Copy Previous Week Data'." },
                numbering: { type: Type.STRING, description: "The major step number, e.g., '1.0'." },
                time_stamp: {
                  type: Type.STRING,
                  description: "The exact timestamp from the video in HH:MM:SS format when this step group begins.",
                  pattern: '^\\d{2}:\\d{2}:\\d{2}$',
                },
                sub_steps: {
                  type: Type.ARRAY,
                  description: "A detailed breakdown of the actions within this step group.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step: { type: Type.STRING, description: "A single, granular action taken by the user, e.g., 'Click on the Refresh button'." },
                      numbering: { type: Type.STRING, description: "The sub-step number, e.g., '1.1'." },
                      time_stamp: {
                        type: Type.STRING,
                        description: "The exact timestamp from the video in HH:MM:SS format for this specific action.",
                        pattern: '^\\d{2}:\\d{2}:\\d{2}$',
                      },
                    },
                  },
                },
              },
            },
          },
          exceptions: {
            type: Type.ARRAY,
            description: "A list of any business or system exceptions identified in the process.",
            items: {
              type: Type.OBJECT,
              properties: {
                exception: { type: Type.STRING, description: "A short name for the exception." },
                description: { type: Type.STRING, description: "A description of how the exception is handled." },
              },
            },
          },
          clarifications: {
            type: Type.ARRAY,
            description: "A list of questions for the SME about ambiguous parts of the process.",
            items: { type: Type.STRING },
          },
        },
        required: ["process_name", "short_process_description", "list_of_steps"]
      },
    },
  });

  // 5. Parse the PDD JSON
  const processData: ProcessDocument = JSON.parse(response.text);

  // 6. Extract thumbnails based on each step/sub-step timestamp
  const thumbsDir = './thumbnails';
  await fs.mkdir(thumbsDir, { recursive: true });
  const tasks: Promise<void>[] = [];

  processData.list_of_steps?.forEach((step: Step) => {
    const stepThumb = path.join(
      thumbsDir,
      `step-${step.numbering.replace(/\./g, '_')}.jpg`
    );
    step.thumbnail = stepThumb;
    tasks.push(extractFrame(videoPath, step.time_stamp, stepThumb));

    step.sub_steps?.forEach((sub: SubStep) => {
      const subThumb = path.join(
        thumbsDir,
        `substep-${sub.numbering.replace(/\./g, '_')}.jpg`
      );
      sub.thumbnail = subThumb;
      tasks.push(extractFrame(videoPath, sub.time_stamp, subThumb));
    });
  });

  console.log(`Extracting ${tasks.length} thumbnails...`);
  await Promise.all(tasks);
  console.log('✅ Thumbnails extracted.');

  // 7. Write the enriched JSON file
  await fs.writeFile(
    'process_steps_with_thumbs.json',
    JSON.stringify(processData, null, 2)
  );
  console.log('✅ process_steps_with_thumbs.json generated');

  // 8. Generate the Word document (if you have the 'generateDocument.ts' file)
  // await generateWordDocument(processData, 'Process_Document.docx');
  await generateWordDocument(processData, 'Process_Document.docx');
}

main().catch((err) => {
  console.error('An unhandled error occurred:', err);
  process.exit(1);
});
