/**
 * Generates the API reference of every public module from the port's TypeScript source:
 * parts, their own props (with types, defaults and descriptions), data attributes and CSS
 * variables. Output: `src/generated/api.json`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript-api';

const root = resolve(import.meta.dirname, '../..');
const src = join(root, 'packages/ui/src');
const outFile = resolve(import.meta.dirname, '../src/generated/api.json');

const PRIVATE_MODULES = new Set(['internals', 'utils', 'types', 'merge-props', 'use-render']);

interface PropDoc {
  name: string;
  type: string;
  default?: string | undefined;
  description: string;
  required: boolean;
}

interface AttributeDoc {
  name: string;
  description: string;
  type?: string | undefined;
}

interface PartDoc {
  name: string;
  /** How it's used in JSX, e.g. `Switch.Root` or `Button`. */
  jsxName: string;
  description: string;
  props: PropDoc[];
  dataAttributes: AttributeDoc[];
  cssVariables: AttributeDoc[];
}

interface ModuleDoc {
  slug: string;
  name: string;
  /** Whether parts are exported as a namespace (`Switch.Root`). */
  namespaced: boolean;
  parts: PartDoc[];
}

const modules = readdirSync(src).filter(
  (name) =>
    !PRIVATE_MODULES.has(name) &&
    !name.startsWith('unstable-') &&
    existsSync(join(src, name, 'index.ts')),
);

const entryFiles = modules.map((name) => join(src, name, 'index.ts'));

const program = ts.createProgram(entryFiles, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: '@solidjs/web',
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  customConditions: ['source'],
  lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  baseUrl: root,
});
const checker = program.getTypeChecker();

function docOf(symbol: ts.Symbol) {
  return ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
}

function tagOf(symbol: ts.Symbol, name: string) {
  const tag = symbol.getJsDocTags(checker).find((t) => t.name === name);
  return tag ? ts.displayPartsToString(tag.text).trim() : undefined;
}

function isOwnDeclaration(declaration: ts.Declaration) {
  const file = declaration.getSourceFile().fileName;
  return file.startsWith(src) && !file.includes('node_modules');
}

function cleanType(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\s*undefined\b/g, '')
    .replace(/^undefined\s*\|\s*/, '')
    .trim();
}

/** Readable forms of the shared prop types, which are generic aliases in the source. */
const FRIENDLY_TYPES: Record<string, string> = {
  class: 'string | ClassValue | ((state: State) => ClassValue)',
  style: 'JSX.CSSProperties | string | ((state: State) => JSX.CSSProperties | string)',
  render: 'keyof JSX.IntrinsicElements | ((props: HTMLProps, state: State) => JSX.Element)',
};

function typeText(symbol: ts.Symbol, declaration: ts.Declaration) {
  const friendly = FRIENDLY_TYPES[symbol.name];
  if (friendly && declaration.getSourceFile().fileName.endsWith('internals/types.ts')) {
    return friendly;
  }
  const node = (declaration as ts.PropertySignature).type;
  if (node) {
    return cleanType(node.getText());
  }
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  return cleanType(checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation));
}

const ORDER = ['class', 'style', 'render'];

function propsOf(component: ts.Symbol): PropDoc[] {
  const declaration = component.valueDeclaration ?? component.declarations?.[0];
  if (!declaration) {
    return [];
  }
  const type = checker.getTypeOfSymbolAtLocation(component, declaration);
  const signature = type.getCallSignatures()[0];
  const parameter = signature?.getParameters()[0];
  if (!signature || !parameter) {
    return [];
  }
  const propsType = checker.getTypeOfSymbolAtLocation(parameter, declaration);
  const props: PropDoc[] = [];
  for (const prop of propsType.getProperties()) {
    const propDeclaration = prop.declarations?.find(isOwnDeclaration);
    if (!propDeclaration || prop.name.startsWith('$') || prop.name === 'children') {
      continue;
    }
    if (tagOf(prop, 'internal') !== undefined || tagOf(prop, 'ignore') !== undefined) {
      continue;
    }
    props.push({
      name: prop.name,
      type: typeText(prop, propDeclaration),
      default: tagOf(prop, 'default'),
      description: docOf(prop),
      required: !(prop.flags & ts.SymbolFlags.Optional),
    });
  }
  // Own props first (alphabetical as authored is noisy), then the shared rendering props.
  return props.sort((a, b) => {
    const ai = ORDER.indexOf(a.name);
    const bi = ORDER.indexOf(b.name);
    if (ai !== bi) {
      return ai - bi;
    }
    return 0;
  });
}

function attributesOf(file: string): AttributeDoc[] {
  const sourceFile = program.getSourceFile(file) ?? ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
  );
  const result: AttributeDoc[] = [];
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }
    for (const declaration of node.declarationList.declarations) {
      if (!declaration.initializer || !ts.isStringLiteral(declaration.initializer)) {
        continue;
      }
      const docs = ts.getJSDocCommentsAndTags(declaration);
      const jsDoc = docs.find(ts.isJSDoc) ?? (node as any).jsDoc?.[0];
      const description =
        typeof jsDoc?.comment === 'string'
          ? jsDoc.comment
          : (ts.getTextOfJSDocComment(jsDoc?.comment) ?? '');
      const typeTag = jsDoc?.tags?.find((tag: ts.JSDocTag) => tag.tagName.text === 'type') as
        | ts.JSDocTypeTag
        | undefined;
      result.push({
        name: declaration.initializer.text,
        description: description.trim(),
        type: typeTag?.typeExpression?.type.getText(),
      });
    }
  });
  return result;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function pascal(slug: string) {
  return slug
    .split('-')
    .map((word) => (word === 'otp' || word === 'csp' ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1)))
    .join('');
}

const result: Record<string, ModuleDoc> = {};

for (const slug of modules) {
  const name = pascal(slug);
  const partsFile = join(src, slug, 'index.parts.ts');
  const namespaced = existsSync(partsFile);
  const entry = program.getSourceFile(namespaced ? partsFile : join(src, slug, 'index.ts'));
  if (!entry) {
    continue;
  }
  const moduleSymbol = checker.getSymbolAtLocation(entry);
  if (!moduleSymbol) {
    continue;
  }
  const files = walk(join(src, slug));
  const dataFiles = files.filter((file) => file.endsWith('DataAttributes.ts'));
  const cssFiles = files.filter((file) => file.endsWith('CssVars.ts'));

  const parts: PartDoc[] = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    if (!(symbol.flags & ts.SymbolFlags.Function)) {
      continue;
    }
    const implementationName = symbol.getName();
    // Only components (PascalCase functions), not helpers like `createHandle` / `useFilter`.
    if (!/^[A-Z]/.test(exported.getName()) || !/^[A-Z]/.test(implementationName)) {
      continue;
    }
    const partName = exported.getName();
    const dataFile = dataFiles.find((file) =>
      file.endsWith(`/${implementationName}DataAttributes.ts`),
    );
    const cssFile = cssFiles.find((file) => file.endsWith(`/${implementationName}CssVars.ts`));
    parts.push({
      name: partName,
      jsxName: namespaced ? `${name}.${partName}` : partName,
      description: docOf(symbol).replace(/\n*Documentation: \[[^\]]*\]\([^)]*\)/, '').trim(),
      props: propsOf(symbol),
      dataAttributes: dataFile ? attributesOf(dataFile) : [],
      cssVariables: cssFile ? attributesOf(cssFile) : [],
    });
  }

  const FIRST = ['Provider', 'Root', 'Trigger'];
  const rank = (part: PartDoc) => {
    const index = FIRST.indexOf(part.name);
    return index === -1 ? FIRST.length : index;
  };
  parts.sort((a, b) => rank(a) - rank(b));

  result[slug] = { slug, name, namespaced, parts };
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `API reference: ${Object.keys(result).length} modules, ${Object.values(result).reduce((n, m) => n + m.parts.length, 0)} parts → ${relative(root, outFile)}`,
);
