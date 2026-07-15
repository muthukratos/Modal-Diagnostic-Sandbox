import type { ScanResult, AnalysisResult, ExplanationResult } from '../types';

const API_BASE = 'http://localhost:8000';

export async function scanFile(file: File): Promise<ScanResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to scan dataset file.');
  }

  return response.json();
}

export async function runAnalysis(
  file: File,
  config: {
    target_column?: string;
    task_type: string;
    test_size: number;
    enable_two_stage: string;
  }
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (config.target_column) {
    formData.append('target_column', config.target_column);
  }
  formData.append('task_type', config.task_type);
  formData.append('test_size', config.test_size.toString());
  formData.append('enable_two_stage', config.enable_two_stage);

  const response = await fetch(`${API_BASE}/upload-and-analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to run model diagnostics.');
  }

  return response.json();
}

export async function explainInstance(
  data: Record<string, any>[],
  target_column: string,
  model_name: string,
  task_type: string,
  instance_to_explain: Record<string, any>
): Promise<ExplanationResult> {
  const payload = {
    data,
    target_column,
    model_name,
    task_type,
    instance_to_explain,
  };

  const response = await fetch(`${API_BASE}/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to generate prediction explanation.');
  }

  return response.json();
}

/**
 * Utility to parse CSV file content to JSON records in the browser.
 * This is used for explainability endpoints that require the background dataset.
 */
export function parseCSV(text: string): Record<string, any>[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !lines[0].trim()) return [];

  // Parse CSV line considering quoted commas
  const parseLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  // Clean headers (remove quotes if present)
  const headers = rawHeaders.map(h => h.replace(/^"|"$/g, '').trim());
  const data: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseLine(line);
    const row: Record<string, any> = {};

    headers.forEach((header, index) => {
      if (!header) return;
      let val = values[index];
      if (val !== undefined) {
        val = val.replace(/^"|"$/g, '').trim();
      }

      if (val === undefined || val === '') {
        row[header] = null;
      } else if (!isNaN(Number(val)) && val !== '') {
        row[header] = Number(val);
      } else {
        row[header] = val;
      }
    });
    data.push(row);
  }

  return data;
}
