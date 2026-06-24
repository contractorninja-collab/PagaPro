/**
 * Creates minimal stub DOCX files with N underline blanks (for dev when real templates are missing).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const PizZip = require("pizzip");

function createStubDocx(underlineCount, title) {
  const paragraphs = [];
  for (let i = 0; i < underlineCount; i++) {
    paragraphs.push(`<w:p><w:r><w:t>${title} — fusha ${i + 1}: ______________</w:t></w:r></w:p>`);
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs.join("")}<w:sectPr/></w:body>
</w:document>`;

  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file("word/document.xml", documentXml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { createStubDocx };
