// Command lines named by a skill, so tests can check they exist in the CLI they document.
const FENCE = /^```(\w*)/;
const SHELL_FENCES = new Set(['bash', 'sh', 'shell', 'console']);

export function extractCommandLines(markdown, cli) {
  const out = [];
  let inShell = false;
  let pending = '';
  for (const raw of markdown.split(/\r?\n/)) {
    const fence = FENCE.exec(raw.trim());
    if (fence) { inShell = !inShell && SHELL_FENCES.has(fence[1]); pending = ''; continue; }
    if (!inShell) continue;
    const line = pending + raw.trim();
    if (line.endsWith('\\')) { pending = line.slice(0, -1).trimEnd() + ' '; continue; }
    pending = '';
    if (line === '' || line.startsWith('#')) continue;
    for (const segment of line.split(/\s*(?:&&|\|\||;|\|)\s*/)) {
      const cmd = segment.replace(/\s+[12]?>.*$/, '').trim();
      if (cmd.startsWith(`${cli} `) || cmd === cli) out.push(cmd);
    }
  }
  return out;
}

const tokens = line => line.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];

export function splitCommand(line) {
  const [, ...rest] = tokens(line);
  const words = [];
  let wordsDone = false;
  const flags = [];
  for (const t of rest) {
    if (t.startsWith('-')) { wordsDone = true; flags.push(t.split('=')[0]); continue; }
    if (wordsDone) continue;
    if (/^[a-z][a-z0-9-]*$/.test(t)) words.push(t); else wordsDone = true;
  }
  return { words, flags: [...new Set(flags)] };
}

export function frontmatter(markdown) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!m) return {};
  const out = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const top = /^([a-z][a-z-]*):\s*(.*)$/.exec(line);
    if (top) {
      key = top[1];
      out[key] = top[2] === '|' || top[2] === '' ? (top[2] === '|' ? '' : []) : top[2];
      continue;
    }
    if (key && Array.isArray(out[key]) && /^\s+-\s+/.test(line)) out[key].push(line.replace(/^\s+-\s+/, '').trim());
    else if (key && typeof out[key] === 'string') out[key] += (out[key] ? '\n' : '') + line.trim();
  }
  return out;
}
