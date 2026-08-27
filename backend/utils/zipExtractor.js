const AdmZip = require('adm-zip');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

/**
 * Extracts a zip of student submissions. Supports two common layouts:
 *   1. one folder per student: studentName/index.js, studentName/util.js ...
 *   2. one flat file per student: studentName.js
 *
 * If a student has multiple files, they are concatenated into a single
 * logical submission (separated by a marker comment) so the AST/similarity
 * pipeline still treats "one student's solution" as one unit.
 *
 * @param {string} zipPath absolute path to the uploaded .zip
 * @returns {{studentName: string, filename: string, code: string}[]}
 */
function extractZip(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const byStudent = new Map();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const ext = path.extname(entry.entryName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
    // skip common noise directories
    if (/(^|\/)(node_modules|\.git|__MACOSX)(\/|$)/.test(entry.entryName)) continue;

    const parts = entry.entryName.split('/').filter(Boolean);
    const studentName = parts.length > 1 ? parts[0] : path.basename(entry.entryName, ext);
    const code = entry.getData().toString('utf8');

    if (!byStudent.has(studentName)) {
      byStudent.set(studentName, { studentName, filename: entry.entryName, chunks: [] });
    }
    byStudent.get(studentName).chunks.push(`// --- ${entry.entryName} ---\n${code}`);
  }

  const submissions = [];
  for (const { studentName, filename, chunks } of byStudent.values()) {
    submissions.push({ studentName, filename, code: chunks.join('\n\n') });
  }
  return submissions;
}

module.exports = { extractZip };
