/**
 * PDF Text & Scanned Image OCR Extractor microservice module.
 * Uses pdf-parse for text PDFs and Tesseract / pdf2pic for scanned document OCR.
 */

export function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractWithOCR(buffer) {
  const MAX_PAGES = 5;
  let allText = "";

  try {
    const { fromBuffer } = await import("pdf2pic");
    const Tesseract = (await import("tesseract.js")).default || await import("tesseract.js");
    
    const convert = fromBuffer(buffer, {
      density: 200,
      format: "png",
      width: 1200,
      height: 1600,
    });

    const images = await convert.bulk(-1, { responseType: "buffer" });
    const pagesToProcess = (images || []).slice(0, MAX_PAGES);
    for (let i = 0; i < pagesToProcess.length; i++) {
      const imgBuffer = pagesToProcess[i].buffer;
      const { data: { text } } = await Tesseract.recognize(imgBuffer, "eng");
      allText += `\n--- Page ${i + 1} ---\n${text}`;
    }
  } catch (err) {
    console.error("[OCR] Bulk PDF image OCR failed, trying single page:", err.message);
    try {
      const Tesseract = (await import("tesseract.js")).default || await import("tesseract.js");
      const { data: { text } } = await Tesseract.recognize(buffer, "eng");
      allText = text;
    } catch (e) {
      console.error("[OCR] Complete OCR failure:", e.message);
    }
  }

  return allText;
}

export async function extractFromPDF(buffer, mimeType = "application/pdf") {
  if (mimeType && mimeType.startsWith("image/")) {
    try {
      const Tesseract = (await import("tesseract.js")).default || await import("tesseract.js");
      const { data: { text } } = await Tesseract.recognize(buffer, "eng");
      return {
        text: cleanText(text),
        pageCount: 1,
        isScanned: true,
      };
    } catch (e) {
      console.error("[OCR] Image recognition error:", e.message);
      return { text: "", pageCount: 1, isScanned: true };
    }
  }

  let extractedText = "";
  let pageCount = 1;
  let isScanned = false;

  try {
    const pdfParse = (await import("pdf-parse")).default || await import("pdf-parse");
    const parsed = await pdfParse(buffer);
    extractedText = parsed.text || "";
    pageCount = parsed.numpages || 1;
  } catch (e) {
    console.warn("[OCR] pdf-parse warning/failure:", e.message);
  }

  const MIN_MEANINGFUL_CHARS = 200;
  if (!extractedText || extractedText.trim().length < MIN_MEANINGFUL_CHARS) {
    console.log("[OCR] Extracted text too short or empty, running OCR pipeline fallback...");
    const ocrText = await extractWithOCR(buffer);
    if (ocrText && ocrText.trim().length > 0) {
      extractedText = ocrText;
      isScanned = true;
    }
  }

  return {
    text: cleanText(extractedText),
    pageCount,
    isScanned,
  };
}
