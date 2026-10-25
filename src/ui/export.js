import { showToast } from './toast.js';

/**
 * Format revision sheet into clean plain text
 */
export function formatAsText(sheet) {
  const lines = [];
  lines.push(`NOTESNAP REVISION SHEET: ${sheet.title || 'Untitled'}`);
  lines.push(`Generated: ${new Date(sheet.updatedAt || Date.now()).toLocaleDateString()}`);
  lines.push(`Stats: ${sheet.stats.compressionRate}% compressed, ~${Math.round(sheet.stats.timeSavedSeconds / 60)} min saved\n`);
  lines.push('='.repeat(40) + '\n');

  if (sheet.groups && sheet.groups.length > 0) {
    for (const group of sheet.groups) {
      lines.push(`[${group.heading.toUpperCase()}]`);
      for (const sent of group.sentences) {
        lines.push(`• ${sent.text}`);
      }
      lines.push('');
    }
  }

  if (sheet.keywords && sheet.keywords.length > 0) {
    lines.push('KEY CONCEPTS:');
    lines.push(sheet.keywords.map(k => `${k.term} (${k.freq}x)`).join(', '));
  }

  return lines.join('\n');
}

/**
 * Format revision sheet into clean Markdown
 */
export function formatAsMarkdown(sheet) {
  const lines = [];
  lines.push(`# ${sheet.title || 'Revision Sheet'}`);
  lines.push(`> *Extracted with NoteSnap • ${sheet.stats.compressionRate}% condensed • ~${Math.round(sheet.stats.timeSavedSeconds / 60)} min reading time saved*\n`);

  if (sheet.groups && sheet.groups.length > 0) {
    for (const group of sheet.groups) {
      lines.push(`## ${group.heading}`);
      for (const sent of group.sentences) {
        lines.push(`- ${sent.text}`);
      }
      lines.push('');
    }
  }

  if (sheet.keywords && sheet.keywords.length > 0) {
    lines.push('### Key Terms');
    lines.push(sheet.keywords.map(k => `\`${k.term}\``).join(' • '));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Trigger file download in browser
 */
function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportText(sheet) {
  const text = formatAsText(sheet);
  const cleanTitle = (sheet.title || 'revision-sheet').toLowerCase().replace(/[^a-z0-9]/g, '-');
  downloadFile(text, `${cleanTitle}-notesnap.txt`, 'text/plain;charset=utf-8');
  showToast('Downloaded .txt revision sheet', { type: 'success' });
}

export function exportMarkdown(sheet) {
  const md = formatAsMarkdown(sheet);
  const cleanTitle = (sheet.title || 'revision-sheet').toLowerCase().replace(/[^a-z0-9]/g, '-');
  downloadFile(md, `${cleanTitle}-notesnap.md`, 'text/markdown;charset=utf-8');
  showToast('Downloaded .md revision sheet', { type: 'success' });
}

export async function copyToClipboard(sheet) {
  const text = formatAsMarkdown(sheet);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    showToast('Revision sheet copied to clipboard!', { type: 'success' });
  } catch (err) {
    showToast('Could not copy to clipboard', { type: 'error' });
  }
}

export function printSheet() {
  window.print();
}
