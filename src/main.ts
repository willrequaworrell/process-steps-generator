import 'dotenv/config';
import fs from 'fs/promises';
import {
  GoogleGenAI,
  Type,
  createPartFromUri,
  createUserContent,
} from '@google/genai';

async function main() {
  const [videoPath, transcriptPath] = process.argv.slice(2);
  if (!videoPath || !transcriptPath) {
    console.error('Usage: node process-video.js <video.mp4> <transcript.txt>');
    process.exit(1);
  }

  // 1️⃣ Initialize client with API key
  const ai = new GoogleGenAI({ apiKey: "YOUR API KEY" });

  // 2️⃣ Upload video file
  console.log(`Uploading ${videoPath}...`);
  const uploaded = await ai.files.upload({
    file: videoPath,
    config: { mimeType: 'video/mp4' },
  });
  console.log('Upload complete, waiting for ACTIVE state...');
  let file = await ai.files.get({ name: uploaded.name });
  while (file.state !== 'ACTIVE') {
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 3000));
    file = await ai.files.get({ name: uploaded.name });
  }
  console.log('\nFile is ACTIVE');

  // 3️⃣ Read transcript
  const transcript = await fs.readFile(transcriptPath, 'utf8');

  // 4️⃣ Generate structured JSON using responseSchema
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: createUserContent([
      createPartFromUri(file.uri, file.mimeType),
      `TRANSCRIPT:\n${transcript}`,
      'You are a senior Business Analyst. Extract the process into the following JSON format:',
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
                time_stamp: { type: Type.STRING },
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
              propertyOrdering: ['group_name', 'numbering', 'time_stamp', 'sub_steps'],
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

  // 5️⃣ Parse and save
  const json = JSON.parse(response.text);
  await fs.writeFile('process_steps.json', JSON.stringify(json, null, 2));
  console.log('✅ process_steps.json generated');
}

main();
