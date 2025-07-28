import fs from 'fs/promises';
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
} from 'docx';
import { ProcessDocument, Step } from './types/index.js';

/**
 * A helper function to create a styled table cell.
 */
const createStyledTableCell = (text: string, bold = false): TableCell => {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
};

/**
 * Generates a PDD-style Word document from the processed data.
 * This is the core function that can be imported by other modules.
 * @param processData The enriched JSON data.
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
          new Paragraph({ text: 'Process Definition Document', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createStyledTableCell('Project:', true), createStyledTableCell(processData.process_name)] }),
              new TableRow({ children: [createStyledTableCell('Process Description:', true), createStyledTableCell(processData.short_process_description)] }),
              new TableRow({ children: [createStyledTableCell('Document Author:', true), createStyledTableCell('Automated Process Generator')] }),
              new TableRow({ children: [createStyledTableCell('Generation Date:', true), createStyledTableCell(new Date().toLocaleDateString())] }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '2.2 Applications Utilized', heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [createStyledTableCell('Name', true), createStyledTableCell('Application Type', true), createStyledTableCell('URL / Path', true)] }),
              ...(processData.list_of_applications || []).map(app => new TableRow({ children: [createStyledTableCell(app.application_name), createStyledTableCell(app.type), createStyledTableCell(app.url || 'N/A')] })),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '5. Detailed Process Steps', heading: HeadingLevel.HEADING_1 }),
          ...(await createStepParagraphs(processData.list_of_steps || [])),
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

// --- FIX: This block is now ES Module safe ---
// It checks if the script is the main entry point of the application.
import { fileURLToPath } from 'url';
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
