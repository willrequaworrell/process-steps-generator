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
import { docGeneratePrompt } from './util/prompts.js';
import { generateWordDocument } from './generateDocument.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Extract a single frame at `timestamp` and save to `outputPath`.
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
        size: '1280x?',
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

async function main() {
  const [videoPath, transcriptPath] = process.argv.slice(2);
  if (!videoPath || !transcriptPath) {
    console.error('Usage: npm start <video.mp4> <transcript.txt>');
    process.exit(1);
  }

  // 1️⃣ Initialize AI client
  const ai = new GoogleGenAI({ apiKey: "" });

  // 2️⃣ Upload video
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

  // 3️⃣ Read transcript
  const transcript = await fs.readFile(transcriptPath, 'utf8');

  // 4️⃣ Call AI for pure PDD JSON (six fields only)
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: createUserContent([
      createPartFromUri(file.uri, file.mimeType),
      `TRANSCRIPT:\n${transcript}`,
      // 'You are a senior Business Analyst. Extract the process into the following JSON format:',
      docGeneratePrompt,
    ]),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          process_name: { type: Type.STRING },
          short_process_description: { type: Type.STRING },
          list_of_applications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                application_name: { type: Type.STRING },
                type: { type: Type.STRING },
                url: { type: Type.STRING },
              },
              propertyOrdering: ['application_name', 'type', 'url'],
            },
          },
          list_of_steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                group_name: { type: Type.STRING },
                numbering: { type: Type.STRING },
                time_stamp: {
                  type: Type.STRING,
                  pattern: '^\\d{2}:\\d{2}:\\d{2}$',
                },
                sub_steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step: { type: Type.STRING },
                      numbering: { type: Type.STRING },
                      time_stamp: { type: Type.STRING },
                    },
                    propertyOrdering: ['step', 'numbering', 'time_stamp'],
                  },
                },
              },
              propertyOrdering: [
                'group_name',
                'numbering',
                'time_stamp',
                'sub_steps',
              ],
            },
          },
          exceptions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                exception: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              propertyOrdering: ['exception', 'description'],
            },
          },
          clarifications: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        propertyOrdering: [
          'process_name',
          'short_process_description',
          'list_of_applications',
          'list_of_steps',
          'exceptions',
          'clarifications',
        ],
      },
    },
  });

  // 5️⃣ Parse the PDD JSON
  const processData: ProcessDocument = JSON.parse(response.text);

  // 6️⃣ Extract thumbnails based on each step/sub-step timestamp
  const thumbsDir = './thumbnails';
  await fs.mkdir(thumbsDir, { recursive: true });
  const tasks: Promise<void>[] = [];

  processData.list_of_steps.forEach((step: Step) => {
    const stepThumb = path.join(
      thumbsDir,
      `step-${step.numbering.replace('.', '_')}.jpg`
    );
    step.thumbnail = stepThumb;
    tasks.push(extractFrame(videoPath, step.time_stamp, stepThumb));

    step.sub_steps.forEach((sub: SubStep) => {
      const subThumb = path.join(
        thumbsDir,
        `substep-${sub.numbering.replace('.', '_')}.jpg`
      );
      sub.thumbnail = subThumb;
      tasks.push(extractFrame(videoPath, sub.time_stamp, subThumb));
    });
  });

  console.log(`Extracting ${tasks.length} thumbnails...`);
  await Promise.all(tasks);
  console.log('✅ Thumbnails extracted.');

  // 7️⃣ Write enriched JSON
  await fs.writeFile(
    'process_steps_with_thumbs.json',
    JSON.stringify(processData, null, 2)
  );
  console.log('✅ process_steps_with_thumbs.json generated');


  await generateWordDocument(processData, 'Process_Document.docx');
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});
