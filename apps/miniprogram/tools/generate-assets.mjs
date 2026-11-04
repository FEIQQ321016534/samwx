/**
 * Convert the reference UI's own SVG drawings and Lucide icons into local PNGs.
 * Run from any directory: node apps/miniprogram/tools/generate-assets.mjs
 * SVG is rendered at build time only; no Lucide/ReactDOM/sharp enters the miniapp.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import sharp from 'sharp';
import ts from 'typescript';
import colors from 'tailwindcss/colors.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceRoot = path.resolve(projectRoot, '../../ui-reference/src');
const artworkDir = path.join(projectRoot, 'src/assets/artwork');
const iconDir = path.join(projectRoot, 'src/assets/icons');
const componentDir = path.join(projectRoot, 'src/components');
await Promise.all([artworkDir, iconDir, componentDir].map((dir) => fs.mkdir(dir, { recursive: true })));

const colorPattern = /text-(?:\[#[\da-fA-F]{3,8}\]|(?:[a-z]+-\d{2,3}|white|black)(?:\/\d{1,3})?)/g;
const colorClasses = new Map();
function colorValue(token) {
  const value = token.replace(/^text-/, '');
  const [base, opacity] = value.split('/');
  let hex;
  if (base.startsWith('[#')) hex = base.slice(1, -1);
  else if (base === 'white') hex = '#ffffff';
  else if (base === 'black') hex = '#000000';
  else {
    const [family, shade] = base.split('-');
    hex = colors[family]?.[shade];
  }
  if (!hex || !/^#[\da-f]{3,8}$/i.test(hex)) return null;
  hex = hex.toLowerCase();
  if (hex.length === 4) hex = '#' + [...hex.slice(1)].map((c) => c + c).join('');
  if (opacity !== undefined) hex += Math.round(Number(opacity) / 100 * 255).toString(16).padStart(2, '0');
  colorClasses.set(token, hex);
  return hex;
}
function colorsIn(value = '') {
  return [...new Set(value.match(colorPattern) || [])].map(colorValue).filter(Boolean);
}
function classText(node, source) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  if (!opening.attributes) return '';
  const attribute = opening.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(source) === 'className');
  return attribute?.initializer?.getText(source) || '';
}
function inheritedColors(node, source) {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (!ts.isJsxElement(ancestor)) continue;
    const result = colorsIn(classText(ancestor, source));
    if (result.length) return result;
  }
  return ['#475569'];
}

// Parse JSX rather than regexing snippets: CodeExportModal contains JSX examples
// inside template strings, which are not UI elements and must not add variants.
const files = [path.join(referenceRoot, 'App.tsx'), ...(await fs.readdir(path.join(referenceRoot, 'components')))
  .filter((name) => name.endsWith('.tsx')).sort().map((name) => path.join(referenceRoot, 'components', name))];
const iconVariants = new Map();
const defaultColors = new Map();
const fallbackCounts = new Map();
function register(name, color, stroke = 2) {
  if (!iconVariants.has(name)) iconVariants.set(name, new Set());
  iconVariants.get(name).add(`${color}|${stroke}`);
}
for (const file of files) {
  const source = ts.createSourceFile(file, await fs.readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const localIcons = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'lucide-react') continue;
    for (const spec of statement.importClause?.namedBindings?.elements || []) {
      const imported = (spec.propertyName || spec.name).text;
      localIcons.set(spec.name.text, imported);
      if (!iconVariants.has(imported)) iconVariants.set(imported, new Set());
    }
  }
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const name = localIcons.get(node.tagName.getText(source));
      if (name) {
        const classes = classText(node, source);
        const explicit = colorsIn(classes);
        const usedColors = explicit.length ? explicit : inheritedColors(node, source);
        const strokes = [...classes.matchAll(/stroke-(?:\[([\d.]+)\]|([\d.]+))/g)].map((match) => Number(match[1] || match[2]));
        for (const color of usedColors) for (const stroke of strokes.length ? strokes : [2]) register(name, color, stroke);
        const counts = fallbackCounts.get(name) || new Map();
        for (const color of usedColors) counts.set(color, (counts.get(color) || 0) + 1);
        fallbackCounts.set(name, counts);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

// Retain exports for imported-but-not-yet-rendered original UI icons too.
for (const [name, variants] of iconVariants) {
  const counts = fallbackCounts.get(name);
  const defaultColor = counts ? [...counts].sort((a, b) => b[1] - a[1])[0][0] : '#475569';
  defaultColors.set(name, defaultColor);
  register(name, defaultColor, 2);
  // Dynamic active tab stroke widths need a normal-stroke fallback in each color.
  for (const variant of [...variants]) register(name, variant.split('|')[0], 2);
}

const sourceRows = [];
const manifest = { generatedFrom: 'ui-reference/src', rasterSize: 72, icons: {} };
for (const name of [...iconVariants.keys()].sort()) {
  if (!lucide[name]) throw new Error(`Missing Lucide export: ${name}`);
  const variants = [...iconVariants.get(name)].sort();
  const rows = [];
  manifest.icons[name] = { defaultColor: defaultColors.get(name), variants: [] };
  for (const variant of variants) {
    const [color, stroke] = variant.split('|');
    const filename = `${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}-${color.slice(1)}-s${stroke.replace('.', '_')}.png`;
    const svg = renderToStaticMarkup(React.createElement(lucide[name], { width: 72, height: 72, color, strokeWidth: Number(stroke) }));
    await sharp(Buffer.from(svg)).png({ palette: true, quality: 100, compressionLevel: 9 }).toFile(path.join(iconDir, filename));
    // The Taro config copies src/assets into dist/assets. Package paths prevent
    // Webpack also emitting a second, hashed copy of each already-copied image.
    rows.push(`    ${JSON.stringify(variant)}: '/assets/icons/${filename}',`);
    manifest.icons[name].variants.push({ key: variant, file: filename });
  }
  sourceRows.push(`  ${name}: {\n${rows.join('\n')}\n  },`);
}

const iconSource = `// Generated by tools/generate-assets.mjs from the reference UI's Lucide icons.
import React from 'react';
import { Image } from '@tarojs/components';

export type IconProps = Omit<React.ComponentProps<typeof Image>, 'src' | 'mode' | 'color'> & {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  title?: string;
};

const sources: Record<string, Record<string, string>> = {
${sourceRows.join('\n')}
};
const defaultColors: Record<string, string> = ${JSON.stringify(Object.fromEntries(defaultColors), null, 2)};
const classColors: Record<string, string> = ${JSON.stringify(Object.fromEntries([...colorClasses].sort()), null, 2)};

function normalizeColor(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('#')) return value.length === 4 ? '#' + value.slice(1).split('').map(c => c + c).join('').toLowerCase() : value.toLowerCase();
  if (value === 'white') return '#ffffff';
  if (value === 'black') return '#000000';
  return value;
}

function makeIcon(name: string): React.FC<IconProps> {
  const Icon: React.FC<IconProps> = ({ className = '', color, strokeWidth, size, style, title, ...props }) => {
    const tokens = className.split(/\\s+/);
    const colorToken = tokens.find(token => Object.prototype.hasOwnProperty.call(classColors, token));
    const objectStyle = typeof style === 'object' ? style : {};
    const requestedColor = normalizeColor(objectStyle.color as string || color) || (colorToken && classColors[colorToken]) || defaultColors[name];
    const strokeClass = tokens.find(token => /^stroke-(?:\\[[\\d.]+\\]|[\\d.]+)$/.test(token));
    const stroke = Number(strokeWidth || strokeClass?.replace(/^stroke-\\[?|\\]$/g, '') || 2);
    const variants = sources[name];
    const src = variants[requestedColor + '|' + stroke] || variants[requestedColor + '|2'] || variants[defaultColors[name] + '|' + stroke] || variants[defaultColors[name] + '|2'];
    const renderedStyle: React.CSSProperties = { display: 'inline-block', verticalAlign: 'middle', ...objectStyle };
    const dimension = typeof size === 'number' ? (size * 2) + 'rpx' : size;
    if (dimension) { renderedStyle.width = dimension; renderedStyle.height = dimension; }
    else {
      if (!tokens.some(token => /^w-/.test(token)) && !renderedStyle.width) renderedStyle.width = '48rpx';
      if (!tokens.some(token => /^h-/.test(token)) && !renderedStyle.height) renderedStyle.height = '48rpx';
    }
    return <Image {...props} className={className} src={src} mode="aspectFit" style={renderedStyle} aria-label={title || name} />;
  };
  Icon.displayName = name;
  return Icon;
}

${[...iconVariants.keys()].sort().map((name) => `export const ${name} = makeIcon('${name}');`).join('\n')}
`;
await fs.writeFile(path.join(componentDir, 'Icons.tsx'), iconSource);
await fs.writeFile(path.join(iconDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Preserve the original four SVG illustrations exactly; CSS background gradients
// and the existing provenance badge remain UI layers in ProductArtwork.tsx.
const artworkSource = await fs.readFile(path.join(referenceRoot, 'components/ProductArtwork.tsx'), 'utf8');
const svgFragments = [...artworkSource.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0]);
if (svgFragments.length !== 4) throw new Error(`Expected 4 reference SVG illustrations, found ${svgFragments.length}`);
const artworkNames = ['bakery', 'meat', 'drink', 'bulk'];
for (const [index, fragment] of svgFragments.entries()) {
  const compiled = ts.transpileModule(`const artwork = (${fragment}); export default artwork;`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } });
  const result = {};
  new Function('React', 'exports', compiled.outputText)(React, result);
  // The original SVG inherits App's sans font; sharp otherwise uses a serif face.
  const svg = renderToStaticMarkup(result.default).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" style="font-family:Arial,Helvetica,sans-serif" ').replace(/ class="[^"]*"/, '');
  await sharp(Buffer.from(svg)).png({ palette: true, quality: 100, compressionLevel: 9 }).toFile(path.join(artworkDir, `${artworkNames[index]}.png`));
}

await fs.writeFile(path.join(componentDir, 'ProductArtwork.tsx'), `// Reference artwork rasterized by tools/generate-assets.mjs for WeChat Image.
import React from 'react';
import { Image, Text, View } from '@tarojs/components';

interface ProductArtworkProps {
  type: 'bakery' | 'meat' | 'drink' | 'snack' | 'grocery' | 'fresh';
  name: string;
  className?: string;
  aspectRatio?: '4:3' | '16:9' | '1:1';
}

const artwork = {
  bakery: '/assets/artwork/bakery.png',
  meat: '/assets/artwork/meat.png',
  drink: '/assets/artwork/drink.png',
  snack: '/assets/artwork/bulk.png',
  grocery: '/assets/artwork/bulk.png',
  fresh: '/assets/artwork/bulk.png',
};
const backgrounds = {
  bakery: 'bg-gradient-to-br from-amber-50 via-amber-100/60 to-orange-100/80',
  meat: 'bg-gradient-to-br from-rose-50 via-red-100/50 to-stone-200',
  drink: 'bg-gradient-to-br from-emerald-50 via-teal-100/50 to-green-100/70',
  snack: 'bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-100',
  grocery: 'bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-100',
  fresh: 'bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-100',
};

export const ProductArtwork: React.FC<ProductArtworkProps> = ({ type, name, className = '', aspectRatio = '4:3' }) => (
  <View className={'relative w-full overflow-hidden select-none ' + className} style={{ paddingTop: aspectRatio === '16:9' ? '56.25%' : aspectRatio === '1:1' ? '100%' : '75%' }}>
    <View className={'absolute inset-0 ' + backgrounds[type]}>
      <Image className="w-full h-full opacity-90" src={artwork[type]} mode="aspectFit" aria-label={name} />
    </View>
    <View className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white/95 font-medium tracking-tight">
      <View className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      <Text>Sam's Club 直采保真</Text>
    </View>
  </View>
);
`);

async function assetSize(dir) {
  const entries = (await fs.readdir(dir)).filter((name) => name.endsWith('.png'));
  const sizes = await Promise.all(entries.map(async (name) => ({ name, bytes: (await fs.stat(path.join(dir, name))).size })));
  return { files: sizes.length, bytes: sizes.reduce((total, item) => total + item.bytes, 0), items: sizes };
}
const [icons, illustrations] = await Promise.all([assetSize(iconDir), assetSize(artworkDir)]);
console.log(JSON.stringify({ iconExports: iconVariants.size, icons: { files: icons.files, bytes: icons.bytes }, artwork: illustrations, totalPngBytes: icons.bytes + illustrations.bytes }, null, 2));
