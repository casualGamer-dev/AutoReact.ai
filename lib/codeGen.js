// Ported from FUNCTIONS/functions/code-gen.js + the assembly loop in
// FUNCTIONS/functions/index.js's createLayoutFile (lines ~131-173), stripped of
// fs/Storage/Firestore I/O so it can run client-side.
//
// Emits properly indented, multi-line source (real newlines, 2-space nesting)
// rather than one crammed line - this is what users actually read on the
// "Show Source Code" screen, so it needs to look like code a person wrote,
// not a minified blob. No external formatter (e.g. prettier) is pulled in to
// do this at runtime - that's a heavy dependency for a mobile bundle just to
// format a handful of lines; the template below is simply written pre-indented.

// object -> RN component(s) that element's JSX needs, so the generated
// import line only lists what's actually used instead of always importing
// every possible component regardless of what's in the sketch.
const IMPORTS_FOR = {
  Textfield: ['TextInput'],
  Text: ['Text'],
  Button: ['TouchableOpacity', 'Text'],
  Image: ['Image'],
  Switch: ['Switch'],
};
const IMPORT_ORDER = ['View', 'Text', 'TouchableOpacity', 'TextInput', 'Switch', 'Image'];

function usedComponents(rowOrder) {
  const used = new Set(['View']); // always the outer container
  for (const row of rowOrder) {
    for (const el of row) for (const name of IMPORTS_FOR[el.object] || []) used.add(name);
  }
  return used;
}

function buildImports(rowOrder) {
  const used = usedComponents(rowOrder);
  const names = IMPORT_ORDER.filter((n) => used.has(n)).join(', ');
  return `import React from 'react';\nimport { StyleSheet, ${names} } from 'react-native';`;
}

// theme is optional (Enhance step only) - defaults reproduce the original
// hardcoded styles exactly, so the offline path is untouched.
function buildStyles(theme, stylesName = 'styles') {
  const primaryColor = theme?.primaryColor || '#7bed9f';
  const borderRadius = theme?.borderRadius ?? 0;
  return `const ${stylesName} = StyleSheet.create({
  container: {
    marginTop: 150,
    justifyContent: 'center',
    flexDirection: 'column',
  },
  rows: {
    justifyContent: 'center',
    flexDirection: 'row',
  },
  input: {
    margin: 15,
    height: 40,
    flex: 2,
    borderColor: 'black',
    borderWidth: 1,
    paddingLeft: 5,
    borderRadius: ${borderRadius},
  },
  btn: {
    margin: 15,
    height: 40,
    width: 100,
    backgroundColor: '${primaryColor}',
    justifyContent: 'center',
    borderRadius: ${borderRadius},
  },
  btnText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'black',
    textAlign: 'center',
  },
  switch: {
    margin: 25,
    height: 40,
    flex: 1,
  },
  img: {
    width: 100,
    height: 100,
    borderRadius: ${borderRadius},
  },
  label: {
    flex: 1,
    margin: 15,
  },
});`;
}

function escapeJsString(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Sketch names are already underscore-joined (see pages/Sketch.js) - turn
// e.g. "my_login_screen" into a valid PascalCase component name "MyLoginScreen".
// Falls back to the original default when there's nothing usable, so callers
// that don't pass a name (e.g. lib/selfcheck.js) keep getting "GeneratedLayout".
function toComponentName(name) {
  const words = String(name || '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1));
  const joined = words.join('');
  if (!joined) return 'GeneratedLayout';
  return /^[A-Za-z]/.test(joined) ? joined : `Layout${joined}`;
}

// labels: optional { [originalPredictionIndex]: string } from the Enhance step's
// Gemini call, applied to Text/Button copy in place of the generic placeholder.
// indent: the leading whitespace this element's line(s) should start at.
function elementTemplate(el, labels, indent, S = 'styles', fit = null, nav = null) {
  const label = (labels && el._idx !== undefined ? labels[el._idx] : undefined) || el.label;
  switch (el.object) {
    case 'Textfield':
      return `${indent}<TextInput style={${fit ? `[${S}.input, { flex: ${fit.flex(el)} }]` : `${S}.input`}}${label ? ` placeholder={'${escapeJsString(label)}'}` : ''} underlineColorAndroid="transparent" autoCapitalize="none" />`;
    case 'Text':
      return `${indent}<Text style={${S}.label}>${label ? escapeJsString(label) : 'Text'}</Text>`;
    case 'Button':
      return (
        `${indent}<TouchableOpacity style={${fit ? `[${S}.btn, { width: '${fit.pct(el)}%' }]` : `${S}.btn`}}${nav && nav(el) !== null ? ` onPress={() => go(${nav(el)})}` : ''}>\n` +
        `${indent}  <Text style={${S}.btnText}>${label ? escapeJsString(label) : 'Button'}</Text>\n` +
        `${indent}</TouchableOpacity>`
      );
    case 'Image':
      // A literal require('yourImage.png') would fail to bundle in a real
      // project (no such file exists) - a real placeholder URI is at least
      // runnable as-is; swap it for your own asset.
      return `${indent}<Image style={${fit ? `[${S}.img, { width: '${fit.pct(el)}%', height: 'auto', aspectRatio: ${fit.ratio(el)} }]` : `${S}.img`}} source={{ uri: 'https://via.placeholder.com/100' }} />`;
    case 'Switch':
      return `${indent}<Switch style={${S}.switch} thumbTintColor="#338a3e" />`;
    default:
      return '';
  }
}

// Sizes relative to the photo, so the generated screen keeps the drawing's
// proportions: fields share a row by width, buttons and images take their share
// of the screen width, images keep their aspect ratio. Only when the photo size
// is known (options.imageWidth); otherwise the original fixed sizes are used.
function makeFit(rowOrder, options) {
  if (!options.imageWidth) return null;
  const clampPct = (v) => Math.max(8, Math.min(100, Math.round(v)));
  return {
    pct: (el) => clampPct((el.width / options.imageWidth) * 100),
    ratio: (el) => (el.height > 0 ? Math.round((el.width / el.height) * 100) / 100 : 1),
    flex: (el) => {
      const row = rowOrder.find((r) => r.includes(el)) || [el];
      const total = row.reduce((sum, e) => sum + (e.width || 0), 0) || 1;
      return Math.max(1, Math.round(((el.width || 0) / total) * 10));
    },
  };
}

// One screen as pieces, so generateCode and generateAppCode share the layout logic.
function screenParts(rowOrder, options, componentName, stylesName, nav = null) {
  const fit = makeFit(rowOrder, options);
  const rowLines = rowOrder.map((row) => {
    const elements = row.map((el) => elementTemplate(el, options.labels, '        ', stylesName, fit, nav)).join('\n');
    return `      <View style={${stylesName}.rows}>\n${elements}\n      </View>`;
  });
  return {
    component: `function ${componentName}(${nav ? '{ go }' : ''}) {
  return (
    <View style={${stylesName}.container}>
${rowLines.join('\n')}
    </View>
  );
}`,
    styles: buildStyles(options.theme, stylesName),
  };
}

// rowOrder: element[][] (from layoutSort.sortIntoRows) -> full RN source as a string.
// options: { theme?: {primaryColor, borderRadius}, labels?: {idx: text}, name?: string,
//            imageWidth?: number (photo width in px; turns on proportional sizing) }
// theme/labels are Enhance-only, optional. name is the sketch's name, optional.
function generateCode(rowOrder, options = {}) {
  const parts = screenParts(rowOrder, options, toComponentName(options.name), 'styles');
  return `${buildImports(rowOrder)}

export default ${parts.component}

${parts.styles}
`;
}

// Several screens -> ONE runnable App.js: every screen is its own component with
// its own styles block, plus a bottom tab bar to switch between them. Needs no
// navigation library, so it runs as-is in Expo Snack.
// screens: [{ id?, name, rowOrder, theme?, labels?, imageWidth? }]; a Button with `goesTo` = another
// screen's id navigates there.
function generateAppCode(screens, options = {}) {
  const names = new Set();
  const indexById = new Map(screens.map((s, i) => [s.id, i]));
  const nav = (el) => (el.goesTo && indexById.has(el.goesTo) ? indexById.get(el.goesTo) : null);
  const built = screens.map((screen, i) => {
    const base = toComponentName(screen.name);
    let componentName = base;
    for (let n = 2; names.has(componentName); n++) componentName = `${base}${n}`;
    names.add(componentName);
    const parts = screenParts(screen.rowOrder, screen, componentName, `styles${i + 1}`, nav);
    return { title: String(screen.name || componentName).replace(/_/g, ' '), componentName, parts, rowOrder: screen.rowOrder };
  });

  const used = new Set(['View', 'Text', 'TouchableOpacity']); // the tab bar needs these
  for (const b of built) for (const n of usedComponents(b.rowOrder)) used.add(n);
  const importNames = IMPORT_ORDER.filter((n) => used.has(n)).join(', ');

  const named = toComponentName(options.name);
  const appName = named === 'GeneratedLayout' ? 'App' : named;
  const list = built.map((b) => `  { title: '${escapeJsString(b.title)}', Component: ${b.componentName} },`).join('\n');

  return `import React, { useState } from 'react';
import { StyleSheet, ${importNames} } from 'react-native';

${built.map((b) => `${b.parts.component}\n\n${b.parts.styles}`).join('\n\n')}

const SCREENS = [
${list}
];

export default function ${appName}() {
  const [active, setActive] = useState(0);
  const { Component } = SCREENS[active];
  return (
    <View style={tabs.root}>
      <View style={tabs.body}>
        <Component go={setActive} />
      </View>
      <View style={tabs.bar}>
        {SCREENS.map((screen, i) => (
          <TouchableOpacity key={screen.title} style={tabs.tab} onPress={() => setActive(i)}>
            <Text style={[tabs.label, i === active && tabs.labelActive]}>{screen.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const tabs = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  bar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#dddddd', backgroundColor: 'white' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  label: { fontSize: 13, color: '#666666' },
  labelActive: { color: '#1f4fd1', fontWeight: '700' },
});
`;
}

module.exports = { generateCode, generateAppCode, buildStyles };
