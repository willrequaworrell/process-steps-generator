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
  ShadingType,
  BorderStyle,
  IBorderOptions,
  HeightRule,
} from 'docx';

import { ProcessDocument, Step } from './types/index.js';

// --- STYLE CONSTANTS ---
const HEADING_COLOR = "253761"; // RGB(37, 55, 97)
const IMAGE_HEIGHT_PT = 337;
const IMAGE_WIDTH_PT = 600;
const TABLE_FONT = "Calibri";

// Font sizes in half-points (1pt = 2 half-points)
const HEADING_1_SIZE = 28; // 14pt
const HEADING_2_SIZE = 24; // 12pt
const HEADING_3_SIZE = 22; // 11pt
const TABLE_FONT_SIZE = 22; // 11pt

const createStyledTableCell = (
  text: string,
  bold = false,
  applyShading = false,
  borderTop: IBorderOptions['style'] = BorderStyle.NONE,
  borderBottom: IBorderOptions['style'] = BorderStyle.NONE,
  borderLeft: IBorderOptions['style'] = BorderStyle.NONE,
  borderRight: IBorderOptions['style'] = BorderStyle.NONE
): TableCell => {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, font: TABLE_FONT, size: TABLE_FONT_SIZE })],
        alignment: AlignmentType.LEFT,
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    shading: applyShading
      ? {
          fill: 'D7E1F2',
          type: ShadingType.CLEAR,
        }
      : undefined,
    borders: {
      top: { style: borderTop, size: 1, color: '000000' },
      bottom: { style: borderBottom, size: 1, color: '000000' },
      left: { style: borderLeft, size: 1, color: '000000' },
      right: { style: borderRight, size: 1, color: '000000' },
    },
  });
};

export async function generateWordDocument(
  processData: ProcessDocument,
  outputPath: string
): Promise<void> {
  console.log('Generating PDD-style Word document...');

  const logoPath = 'src/assets/LHX Logo.png';
  const l3harrisLogo = await fs.readFile(logoPath).catch(() => {
      console.warn(`Warning: '${logoPath}' not found. The logo will not be included.`);
      return null;
  });

  const doc = new Document({
    styles: {
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', run: { font: TABLE_FONT, size: TABLE_FONT_SIZE } },
        {
          id: 'TitleStyle', name: 'Title Style', basedOn: 'Normal', next: 'Normal',
          run: { size: 44, bold: true, color: HEADING_COLOR },
        },
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: TABLE_FONT, size: HEADING_1_SIZE, bold: true, color: HEADING_COLOR },
          paragraph: { spacing: { after: 200 } }
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: TABLE_FONT, size: HEADING_2_SIZE, bold: true, color: HEADING_COLOR },
          paragraph: { spacing: { after: 150 } }
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: TABLE_FONT, size: HEADING_3_SIZE, bold: true },
          paragraph: { spacing: { after: 100 } }
        },
        {
          id: 'TableTitle', name: 'Table Title', basedOn: 'Normal', next: 'Normal',
          run: { font: TABLE_FONT, size: HEADING_3_SIZE, bold: true, color: HEADING_COLOR },
        },
      ]
    },
    sections: [
      {
        children: [
            // Header using a table with invisible borders for reliable layout
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: [7500, 2500],
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [
                                    new Paragraph({ text: processData.process_name, style: 'TitleStyle', alignment: AlignmentType.LEFT }),
                                    new Paragraph({ text: 'Process Definition Document', style: 'TableTitle', alignment: AlignmentType.LEFT })
                                ],
                                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                                verticalAlign: VerticalAlign.CENTER,
                            }),
                            new TableCell({
                                children: l3harrisLogo ? [
                                    new Paragraph({
                                        children: [
                                            // Set a fixed 3:2 ratio for the logo size
                                            new ImageRun({ type: 'png', data: l3harrisLogo, transformation: { width: 150, height: 100 } })
                                        ],
                                        alignment: AlignmentType.RIGHT,
                                    })
                                ] : [],
                                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                                verticalAlign: VerticalAlign.CENTER,
                            }),
                        ],
                    }),
                ],
            }),
          new Paragraph({ text: '' }),

          // --- TOP INFO TABLES ---
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [2500, 7500],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Project:', true, true), createStyledTableCell(processData.process_name)] }),
              // FIX: This row now uses process_name, description is moved below.
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Process:', true, true), createStyledTableCell(processData.process_name)] }),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Prepared by:', true, true), createStyledTableCell('Automated Process Generator')] }),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Role:', true, true), createStyledTableCell('Bot/System')] }),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Date:', true, true), createStyledTableCell(new Date().toLocaleDateString())] }),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Version:', true, true), createStyledTableCell('1.0.0')] }),
            ]
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: 'APPROVER/BUSINESS SIGN-OFF', style: 'TableTitle', alignment: AlignmentType.LEFT }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [2500, 7500],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Approved by:', true, true), createStyledTableCell('')] }),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Role:', true, true), createStyledTableCell('')] }),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Date:', true, true), createStyledTableCell('')] }),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [createStyledTableCell('Version:', true, true), createStyledTableCell('')] }),
            ]
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: 'CONTACTS', style: 'TableTitle', alignment: AlignmentType.LEFT }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [5000, 5000],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Name', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Role', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              ...['Customer/SME', 'Business Analyst', 'Blue Prism Developer', 'RPA Director', 'RPA Manager', 'Blue Prism Sys Admin']
                .map(role => new TableRow({
                  height: { value: 300, rule: HeightRule.ATLEAST },
                  children: [
                    createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                    createStyledTableCell(role, false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
                  ]
                }))
            ]
          }),
          new Paragraph({ text: '' }),

          // --- DOCUMENT BODY ---
          new Paragraph({ text: '1.0 INTRODUCTION', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT }),
          new Paragraph({
            text: 'The purpose of this document is to capture the flow of the as is business process that is to be automated in Blue Prism.',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '2.0 OVERVIEW', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT }),
          new Paragraph({ text: '2.1 Manual Process Overview', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.LEFT }),
          // FIX: Process description is now placed here.
          new Paragraph({ text: processData.short_process_description, alignment: AlignmentType.LEFT }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '2.2 Manual Process Description', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.LEFT }),
          new Paragraph({ text: '[A description of the current manual process.]', alignment: AlignmentType.LEFT }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '2.4 Target Systems', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.LEFT }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [2000, 4000, 2000, 2000],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Name', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Description', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Application Type', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Internal to L3H', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              ...(processData.list_of_applications || []).map(app => new TableRow({
                height: { value: 300, rule: HeightRule.ATLEAST },
                children: [
                  createStyledTableCell(app.application_name, false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                  createStyledTableCell(app.url || '', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                  createStyledTableCell(app.type || 'e.g. Web App/ Desktop', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                  createStyledTableCell('e.g. Yes/No', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
                ]
              })),
            ]
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '2.5 System Access Requirements', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.LEFT }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('System / App', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Purpose', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Environ-ment', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Specific Access', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Specific Role', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Specify Non Prod Environments', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Data refresh need in Non Prod Environment', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Application Security', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('Fully Qualified Path to Shared folder/ App URL', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
              ]}),
              ...(processData.list_of_applications || []).map(app => new TableRow({
                height: { value: 300, rule: HeightRule.ATLEAST },
                children: [
                  createStyledTableCell(app.application_name, false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                  ...Array(7).fill(createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)),
                  createStyledTableCell(app.url || '', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
                ]
              })),
              ...Array(Math.max(0, 4 - (processData.list_of_applications?.length || 0))).fill(null).map(() => new TableRow({
                height: { value: 300, rule: HeightRule.ATLEAST },
                children: Array(9).fill(null).map(() =>
                  createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
                )
              }))
            ]
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '2.6 Run Criteria', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.LEFT }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [2500, 7500],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Process Frequency', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Process Start Time', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Process Completion Time', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
            ]
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '2.7 Interfaces Involved', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.LEFT }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [2500, 7500],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Source System', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Destination System', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Time to transfer', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Frequency', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
            ]
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '3.0 IMPACTED BUSINESS AREAS', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [5000, 5000],
            rows: [
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST }, children: [
                createStyledTableCell('Impacted Business Areas', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                createStyledTableCell('SME responsible for each Business Area', true, true, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
              ]}),
              new TableRow({ height: { value: 300, rule: HeightRule.ATLEAST },
                children: [
                  createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE),
                  createStyledTableCell('', false, false, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE, BorderStyle.SINGLE)
                ]
              }),
            ]
          }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '4.0 CURRENT PROCESS DIAGRAM', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT }),
          new Paragraph({ text: '[Detailed business process flow diagram depicting each stage of the business process.]', alignment: AlignmentType.LEFT }),
          new Paragraph({ text: '' }),

          new Paragraph({ text: '5.0 PROCESS DETAILS', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT }),
          ...(await createStepParagraphs(processData.list_of_steps || [])),
          new Paragraph({ text: '' }),
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
  console.log(`✅ PDD document generated successfully at: ${outputPath}`);
}

async function createStepParagraphs(steps: Step[]): Promise<Paragraph[]> {
  const allParagraphs: Paragraph[] = [];

  for (const step of steps) {
    allParagraphs.push(
      new Paragraph({
        text: `${step.numbering} ${step.group_name}`,
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
      })
    );

    for (const subStep of step.sub_steps) {
      allParagraphs.push(
        new Paragraph({
          text: `${subStep.numbering} ${subStep.step} (Timestamp: ${subStep.time_stamp})`,
          heading: HeadingLevel.HEADING_3,
          indent: { left: 200 },
          alignment: AlignmentType.LEFT,
        })
      );
      if (subStep.thumbnail) {
        try {
          const imageBuffer = await fs.readFile(subStep.thumbnail);
          allParagraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  type: 'jpg',
                  data: imageBuffer,
                  transformation: { width: IMAGE_WIDTH_PT, height: IMAGE_HEIGHT_PT },
                }),
              ],
              indent: { left: 200 },
              alignment: AlignmentType.CENTER,
            })
          );
          allParagraphs.push(new Paragraph({ text: '' }));
        } catch (error) {
          console.warn(`Warning: Could not read thumbnail for sub-step ${subStep.numbering}: ${subStep.thumbnail}`, error);
        }
      }
    }
    allParagraphs.push(new Paragraph({ text: '' }));
  }
  return allParagraphs;
}

// --- ESM-safe main ---
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
