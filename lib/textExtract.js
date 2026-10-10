/**
 * textExtract.js — Download a file from a URL and extract its plain text.
 *
 * Supports:
 *   .pdf  → pdf-parse
 *   .docx → mammoth
 *   .pptx → pptx-parser (reads slide XML via jszip)
 *
 * Returns a plain-text string.  Throws on unsupported file types.
 */

import { createRequire } from "module";
import mammoth from "mammoth";
import JSZip from "jszip";

// pdf-parse is a CJS package; use createRequire to load it in an ESM project
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");


/**
 * Fetch file bytes from a URL (Cloudinary secure_url).
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file from ${url}: HTTP ${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Extract text from a PPTX buffer by reading slide XML files inside the ZIP.
 * No external PPTX library needed — PPTX is just a ZIP of XML files.
 * @param {Buffer} buf
 * @returns {Promise<string>}
 */
async function extractPptxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const slideKeys = Object.keys(zip.files).filter(
    (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/)
  );

  // Sort slides numerically
  slideKeys.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
    const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
    return numA - numB;
  });

  const texts = await Promise.all(
    slideKeys.map(async (key) => {
      const xmlStr = await zip.files[key].async("text");
      // Strip XML tags, decode entities, collapse whitespace
      return xmlStr
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    })
  );

  return texts.filter(Boolean).join("\n\n");
}

/**
 * Main extraction entry point.
 * @param {string} fileUrl  — Cloudinary secure URL
 * @param {string} fileName — original file name (used to detect extension)
 * @returns {Promise<string>} — plain text content of the document
 */
export async function extractText(fileUrl, fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const buf = await fetchBuffer(fileUrl);

  switch (ext) {
    case "pdf": {
      const result = await pdfParse(buf);
      return result.text ?? "";
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value ?? "";
    }
    case "pptx": {
      return extractPptxText(buf);
    }
    default:
      throw new Error(`Unsupported file extension: .${ext}`);
  }
}
