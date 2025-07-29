// src/generateDocument.ts

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
} from 'docx';
import { ProcessDocument, Step } from './types/index.js';

/**
 * A helper function to create a styled table cell. This reduces code repetition.
 */
const createStyledTableCell = (text: string, bold = false): TableCell => {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    verticalAlign: VerticalAlign.CENTER,
  });
};

/**
 * Generates a PDD-style Word document from the processed data.
 * @param processData The enriched JSON data from your file.
 * @param outputPath The path where the .docx file will be saved.
 */
export async function generateWordDocument(
  processData: ProcessDocument,
  outputPath: string
): Promise<void> {
  console.log('Generating PDD-style Word document...');

  const doc = new Document({
    styles: {
      paragraphStyles: [{ id: 'Normal', name: 'Normal', run: { font: 'Calibri', size: 22 } }],
    },
    sections: [
      {
        children: [
          // Section 1: Main Title
          new Paragraph({ text: 'Process Definition Document', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: '' }),

          // Section 2: Metadata Table (mimicking the PDD template)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createStyledTableCell('Project:', true), createStyledTableCell(processData.process_name)] }),
              new TableRow({ children: [createStyledTableCell('Process:', true), createStyledTableCell(processData.short_process_description)] }),
              new TableRow({ children: [createStyledTableCell('Prepared by:', true), createStyledTableCell('Automated Process Generator')] }),
              new TableRow({ children: [createStyledTableCell('Date:', true), createStyledTableCell(new Date().toLocaleDateString())] }),
            ],
          }),
          new Paragraph({ text: '' }),

          // Section 3: Applications Utilized Table
          new Paragraph({ text: '2.2 Applications Utilized', heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Header Row
              new TableRow({
                children: [
                  createStyledTableCell('Name', true),
                  createStyledTableCell('Description / Purpose', true),
                  createStyledTableCell('Application Type', true),
                ],
              }),
              // Data Rows from JSON
              ...(processData.list_of_applications || []).map(app => new TableRow({
                children: [
                  createStyledTableCell(app.application_name),
                  // Assuming your AI call provides 'description' in the application object now
                  createStyledTableCell(app.url || 'Purpose not specified.'), 
                  createStyledTableCell(app.type),
                ],
              })),
            ],
          }),
          new Paragraph({ text: '' }),

          // Section 4: Detailed Process Steps
          new Paragraph({ text: '5.0 Detailed Process Steps', heading: HeadingLevel.HEADING_1 }),
          ...(await createStepParagraphs(processData.list_of_steps || [])),
          
          new Paragraph({ text: '' }),

          // Section 5: Business Exceptions
          new Paragraph({ text: '6.0 Business Exceptions', heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({ children: [createStyledTableCell('Exception', true), createStyledTableCell('Handling', true)] }),
                ...(processData.exceptions || []).map(ex => new TableRow({
                    children: [createStyledTableCell(ex.exception), createStyledTableCell(ex.description)]
                }))
            ]
          })
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
  console.log(`✅ PDD document generated successfully at: ${outputPath}`);
}

/**
 * A helper function to create the paragraphs for each step and its sub-steps.
 */
async function createStepParagraphs(steps: Step[]): Promise<Paragraph[]> {
    const allParagraphs: Paragraph[] = [];
    for (const step of steps) {
        allParagraphs.push(new Paragraph({ text: `${step.numbering} ${step.group_name}`, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
        if (step.thumbnail) {
            try {
                const imageBuffer = await fs.readFile(step.thumbnail);
                allParagraphs.push(new Paragraph({ children: [new ImageRun({ type: 'jpg', data: imageBuffer, transformation: { width: 500, height: 281 } })], alignment: AlignmentType.CENTER }));
            } catch (error) { console.warn(`Warning: Could not read thumbnail for step ${step.numbering}: ${step.thumbnail}. ${error}`); }
        }
        for (const subStep of step.sub_steps) {
            allParagraphs.push(new Paragraph({ text: `${subStep.numbering} ${subStep.step} (Timestamp: ${subStep.time_stamp})`, bullet: { level: 0 }, indent: { left: 720 } }));
            if (subStep.thumbnail) {
                try {
                    const imageBuffer = await fs.readFile(subStep.thumbnail);
                    allParagraphs.push(new Paragraph({ children: [new ImageRun({ type: 'jpg', data: imageBuffer, transformation: { width: 400, height: 225 } })], indent: { left: 720 } }));
                } catch (error) { console.warn(`Warning: Could not read thumbnail for sub-step ${subStep.numbering}: ${subStep.thumbnail}. ${error}`); }
            }
        }
        allParagraphs.push(new Paragraph({ text: '' }));
    }
    return allParagraphs;
}

// --- This block makes the script runnable from the command line (ESM safe) ---
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, inputFile, outputFile] = process.argv;

  if (inputFile && outputFile) {
    console.log(`Reading data from: ${inputFile}`);
    fs.readFile(inputFile, 'utf8')
      .then(jsonData => JSON.parse(jsonData) as ProcessDocument)
      .then(processData => generateWordDocument(processData, outputFile))
      .catch(error => {
        console.error('An error occurred while generating the document from JSON:', error);
        process.exit(1);
      });
  } else {
    console.log('--- Standalone PDD Word Document Generator ---');
    console.log('Usage: npm run generate:doc <path_to_input.json> <path_to_output.docx>');
    console.log('Example: npm run generate:doc process_document_with_thumbnails.json MyPDD.docx');
  }
}
