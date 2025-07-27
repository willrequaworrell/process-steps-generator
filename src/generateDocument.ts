// src/generate-document.ts

import fs from 'fs/promises';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

// Import the shared types from your types file
import { ProcessDocument, Step } from './types/index.js';

/**
 * Generates a Word document from the processed PDD data.
 * @param processData The enriched JSON data containing process steps and thumbnail paths.
 * @param outputPath The path where the .docx file will be saved.
 */
export async function generateWordDocument(
  processData: ProcessDocument,
  outputPath: string
): Promise<void> {
  console.log('Generating Word document...');

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            font: 'Calibri',
            size: 22, // 11pt font
          },
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({
            text: processData.process_name,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),

          new Paragraph({ text: '' }),

          new Paragraph({
            children: [
              new TextRun({ text: 'Process Description: ', bold: true }),
              new TextRun(processData.short_process_description),
            ],
          }),

          new Paragraph({ text: '' }),

          ...(await createStepParagraphs(processData.list_of_steps)),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
  console.log(`✅ Word document generated successfully at: ${outputPath}`);
}

/**
 * A helper function to create the paragraphs for each step and its sub-steps.
 */
async function createStepParagraphs(steps: Step[]): Promise<Paragraph[]> {
  const allParagraphs: Paragraph[] = [];

  for (const step of steps) {
    allParagraphs.push(
      new Paragraph({
        text: `${step.numbering} ${step.group_name}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200 },
      })
    );

    if (step.thumbnail) {
      try {
        const imageBuffer = await fs.readFile(step.thumbnail);
        allParagraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                type: 'jpg', // FIX: Explicitly define the media type
                data: imageBuffer,
                transformation: {
                  width: 500,
                  height: 281,
                },
              }),
            ],
            alignment: AlignmentType.CENTER,
          })
        );
      } catch (error) {
        console.warn(`Warning: Could not read thumbnail for step ${step.numbering}: ${step.thumbnail}. ${error}`);
      }
    }

    for (const subStep of step.sub_steps) {
      allParagraphs.push(
        new Paragraph({
          text: `${subStep.numbering} ${subStep.step} (Timestamp: ${subStep.time_stamp})`,
          bullet: { level: 0 },
          indent: { left: 720 },
        })
      );

      if (subStep.thumbnail) {
        try {
          const imageBuffer = await fs.readFile(subStep.thumbnail);
          allParagraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  type: 'jpg', // FIX: Explicitly define the media type
                  data: imageBuffer,
                  transformation: {
                    width: 400,
                    height: 225,
                  },
                }),
              ],
              indent: { left: 720 },
            })
          );
        } catch (error) {
          console.warn(`Warning: Could not read thumbnail for sub-step ${subStep.numbering}: ${subStep.thumbnail}. ${error}`);
        }
      }
    }
    allParagraphs.push(new Paragraph({ text: '' }));
  }

  return allParagraphs;
}
