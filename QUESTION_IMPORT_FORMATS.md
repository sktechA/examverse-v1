# Question Import Formats

Admin Question Bank accepts:
- TXT — recommended for structured bulk questions
- CSV — comma/semicolon/tab delimited; bilingual columns supported
- XLSX/XLS — first worksheet is parsed using the existing XLSX parser
- DOCX — Word document text is extracted and passed through the same question parser
- PDF — text-layer PDFs are extracted and passed through the same question parser

Common question fields supported by the parser include question, Hindi question, options A-D, Hindi options A-D, answer, explanation, Hindi explanation, subject, topic, difficulty and exam metadata.

Scanned/image-only PDFs are not OCR'd by the browser parser. Such files should be OCR'd first or supplied as TXT/CSV/XLSX/DOCX. The parser does not silently fabricate missing question data.
