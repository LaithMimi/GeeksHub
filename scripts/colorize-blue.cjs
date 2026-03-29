const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.resolve(__dirname, '../src');

const REPLACEMENTS = [
  // Tailwind class prefixes
  [/\bpurple-/g,                    'blue-'],
  [/\bindigo-/g,                    'blue-'],

  // CSS custom property names
  [/--glow-indigo\b/g,              '--glow-blue'],
  [/--glow-indigo-soft\b/g,         '--glow-blue-soft'],
  [/--glow-purple\b/g,              '--glow-blue'],
  [/--glow-purple-soft\b/g,         '--glow-blue-soft'],

  // Utility class names in CSS
  [/\.glow-purple\b/g,              '.glow-blue'],
  [/\.glow-purple-soft\b/g,         '.glow-blue-soft'],
  [/\.glow-purple-strong\b/g,       '.glow-blue-strong'],
  [/\.glow-indigo\b/g,              '.glow-blue'],
  [/\.glow-indigo-soft\b/g,         '.glow-blue-soft'],

  // Hardcoded old purple hex (rgba form used in glass tokens)
  [/rgba\(139,\s*92,\s*246/g,       'rgba(37, 99, 235'],   // #8b5cf6 → #2563eb
  [/rgba\(99,\s*102,\s*241/g,       'rgba(37, 99, 235'],   // #6366f1 → #2563eb

  // HSL vars — primary hue shift 245→220, 262→220
  [/hsl\(245\b/g,                   'hsl(220'],
  [/hsl\(262\b/g,                   'hsl(220'],
  [/245\s+80%/g,                    '220 85%'],
  [/262\s+83%/g,                    '220 85%'],
];

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) return walk(full);
    if (!/\.(tsx?|css|js)$/.test(f)) return;

    let src = fs.readFileSync(full, 'utf8');
    let out = src;
    REPLACEMENTS.forEach(([from, to]) => { out = out.replace(from, to); });
    if (out !== src) {
      fs.writeFileSync(full, out);
      console.log('Updated:', path.relative(SRC_DIR, full));
    }
  });
}

walk(SRC_DIR);
console.log('Done. Run: git diff --stat to review scope.');
