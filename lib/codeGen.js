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

function buildImports(rowOrder) {
  const used = new Set(['View']); // always the outer container
  for (const row of rowOrder) {
    for (const el of row) for (const name of IMPORTS_FOR[el.object] || []) used.add(name);
  }
  const names = IMPORT_ORDER.filter((n) => used.has(n)).join(', ');
  return `import React from 'react';\nimport { StyleSheet, ${names} } from 'react-native';`;
}

// theme is optional (Enhance step only) - defaults reproduce the original
// hardcoded styles exactly, so the offline path is untouched.
function buildStyles(theme) {
  const primaryColor = theme?.primaryColor || '#7bed9f';
  const borderRadius = theme?.borderRadius ?? 0;
  return `const styles = StyleSheet.create({
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
function elementTemplate(el, labels, indent) {
  const label = labels && el._idx !== undefined ? labels[el._idx] : undefined;
  switch (el.object) {
    case 'Textfield':
      return `${indent}<TextInput style={styles.input} underlineColorAndroid="transparent" autoCapitalize="none" />`;
    case 'Text':
      return `${indent}<Text style={styles.label}>${label ? escapeJsString(label) : 'Text'}</Text>`;
    case 'Button':
      return (
        `${indent}<TouchableOpacity style={styles.btn}>\n` +
        `${indent}  <Text style={styles.btnText}>${label ? escapeJsString(label) : 'Button'}</Text>\n` +
        `${indent}</TouchableOpacity>`
      );
    case 'Image':
      // A literal require('yourImage.png') would fail to bundle in a real
      // project (no such file exists) - a real placeholder URI is at least
      // runnable as-is; swap it for your own asset.
      return `${indent}<Image style={styles.img} source={{ uri: 'https://via.placeholder.com/100' }} />`;
    case 'Switch':
      return `${indent}<Switch style={styles.switch} thumbTintColor="#338a3e" />`;
    default:
      return '';
  }
}

// rowOrder: element[][] (from layoutSort.sortIntoRows) -> full RN source as a string.
// options: { theme?: {primaryColor, borderRadius}, labels?: {idx: text}, name?: string }
// theme/labels are Enhance-only, optional. name is the sketch's name, optional.
function generateCode(rowOrder, options = {}) {
  const rowLines = rowOrder.map((row) => {
    const elements = row.map((el) => elementTemplate(el, options.labels, '        ')).join('\n');
    return `      <View style={styles.rows}>\n${elements}\n      </View>`;
  });
  const componentName = toComponentName(options.name);

  return `${buildImports(rowOrder)}

export default function ${componentName}() {
  return (
    <View style={styles.container}>
${rowLines.join('\n')}
    </View>
  );
}

${buildStyles(options.theme)}
`;
}

module.exports = { generateCode, buildStyles };
