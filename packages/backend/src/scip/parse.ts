import { fromBinary } from "@bufbuild/protobuf";
import {
    Document,
    Index,
    IndexSchema,
    Occurrence,
    PositionEncoding,
    SymbolInformation,
    SymbolInformation_Kind,
} from "@scip-code/scip";

/**
 * Helpers to turn a SCIP index (https://github.com/scip-code/scip) into flat rows
 * that can be stored in the database.
 *
 * All positions produced by this module are 0-based and expressed in UTF-16 code
 * units, which is what the browser editor (CodeMirror) uses.
 */

export type OccurrenceRow = {
    filePath: string;
    symbol: string;
    roles: number;
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
};

export type SymbolRow = {
    symbol: string;
    name: string;
    displayName: string | null;
    kind: string | null;
    signature: string | null;
    documentation: string | null;
};

export type ParsedDocument = {
    filePath: string;
    occurrences: OccurrenceRow[];
    symbols: SymbolRow[];
};

export const decodeScipIndex = (bytes: Uint8Array): Index => {
    return fromBinary(IndexSchema, bytes);
}

export const isLocalSymbol = (symbol: string) => symbol.startsWith('local ');

/**
 * Splits a SCIP symbol into its header fields and descriptor string.
 *
 * Grammar: <scheme> ' ' <manager> ' ' <package-name> ' ' <version> ' ' <descriptors>
 * where a literal space inside a field is escaped as two spaces.
 *
 * @see https://github.com/scip-code/scip/blob/main/scip.proto (Symbol)
 */
export const splitSymbol = (symbol: string): { scheme: string, manager: string, packageName: string, version: string, descriptors: string } | undefined => {
    if (isLocalSymbol(symbol)) {
        return undefined;
    }

    const fields: string[] = [];
    let current = '';
    let i = 0;
    while (i < symbol.length && fields.length < 4) {
        const ch = symbol[i];
        if (ch === ' ') {
            if (symbol[i + 1] === ' ') {
                current += ' ';
                i += 2;
                continue;
            }
            fields.push(current);
            current = '';
            i += 1;
            continue;
        }
        current += ch;
        i += 1;
    }

    if (fields.length < 4) {
        return undefined;
    }

    const [scheme, manager, packageName, version] = fields;
    return {
        scheme,
        manager,
        packageName,
        version,
        descriptors: symbol.slice(i),
    };
}

/**
 * Returns the name of the last descriptor of a SCIP symbol, e.g.
 * `scip-typescript npm pkg 1.0.0 src/`foo.ts`/Foo#bar().` -> `bar`.
 *
 * Returns an empty string for local symbols or symbols that can't be parsed.
 */
export const getSymbolName = (symbol: string): string => {
    const parts = splitSymbol(symbol);
    if (!parts) {
        return '';
    }

    const { descriptors } = parts;
    let lastName = '';
    let i = 0;

    const readName = (): string => {
        if (descriptors[i] === '`') {
            let name = '';
            i += 1;
            while (i < descriptors.length) {
                if (descriptors[i] === '`') {
                    if (descriptors[i + 1] === '`') {
                        name += '`';
                        i += 2;
                        continue;
                    }
                    i += 1;
                    break;
                }
                name += descriptors[i];
                i += 1;
            }
            return name;
        }

        let name = '';
        while (i < descriptors.length && /[A-Za-z0-9_+\-$]/.test(descriptors[i])) {
            name += descriptors[i];
            i += 1;
        }
        return name;
    }

    while (i < descriptors.length) {
        const ch = descriptors[i];
        // Type parameter `[name]` or parameter `(name)`.
        if (ch === '[' || ch === '(') {
            const close = ch === '[' ? ']' : ')';
            i += 1;
            const name = readName();
            if (descriptors[i] === close) {
                i += 1;
            }
            // A method descriptor looks like `name(disambiguator).`, which is not a
            // parameter. Only treat it as a name when it is non-empty and not followed
            // by '.' (method suffix).
            if (descriptors[i] === '.') {
                i += 1;
                continue;
            }
            if (name) {
                lastName = name;
            }
            continue;
        }

        const name = readName();
        if (!name) {
            // Unknown character, skip it to avoid an infinite loop.
            i += 1;
            continue;
        }
        lastName = name;

        // Consume the suffix.
        const suffix = descriptors[i];
        if (suffix === '/' || suffix === '#' || suffix === '.' || suffix === ':' || suffix === '!') {
            i += 1;
        }
    }

    return lastName;
}

/**
 * Converts a UTF-8 byte offset within `line` into a UTF-16 code unit offset.
 */
export const utf8OffsetToUtf16 = (line: string, byteOffset: number): number => {
    let bytes = 0;
    let utf16 = 0;
    for (const char of line) {
        if (bytes >= byteOffset) {
            break;
        }
        const codePoint = char.codePointAt(0)!;
        bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
        utf16 += char.length;
    }
    return utf16;
}

/**
 * Converts a UTF-32 (code point) offset within `line` into a UTF-16 code unit offset.
 */
export const utf32OffsetToUtf16 = (line: string, codePointOffset: number): number => {
    let count = 0;
    let utf16 = 0;
    for (const char of line) {
        if (count >= codePointOffset) {
            break;
        }
        count += 1;
        utf16 += char.length;
    }
    return utf16;
}

// eslint-disable-next-line no-control-regex
const NON_ASCII_REGEX = /[^\x00-\x7f]/;

const normalizeRange = (occurrence: Occurrence): [number, number, number, number] | undefined => {
    const typed = occurrence.typedRange;
    if (typed.case === 'singleLineRange') {
        return [typed.value.line, typed.value.startCharacter, typed.value.line, typed.value.endCharacter];
    }
    if (typed.case === 'multiLineRange') {
        return [typed.value.startLine, typed.value.startCharacter, typed.value.endLine, typed.value.endCharacter];
    }

    const range = occurrence.range;
    if (range.length === 3) {
        return [range[0], range[1], range[0], range[2]];
    }
    if (range.length === 4) {
        return [range[0], range[1], range[2], range[3]];
    }
    return undefined;
}

const formatSymbolInformation = (info: SymbolInformation): SymbolRow | undefined => {
    if (!info.symbol || isLocalSymbol(info.symbol)) {
        return undefined;
    }

    const name = getSymbolName(info.symbol);
    const documentation = info.documentation.filter((doc) => doc.trim().length > 0);

    // Older indexers put the signature (as a code block) in the first documentation entry.
    let signature = info.signatureDocumentation?.text || null;
    if (!signature && documentation.length > 0 && documentation[0].startsWith('```')) {
        signature = documentation.shift()!.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
    }

    return {
        symbol: info.symbol,
        name: name || info.displayName,
        displayName: info.displayName || null,
        kind: info.kind !== SymbolInformation_Kind.UnspecifiedKind ? (SymbolInformation_Kind[info.kind] ?? null) : null,
        signature,
        documentation: documentation.length > 0 ? documentation.join('\n\n') : null,
    };
}

export type ParseDocumentOptions = {
    /** Encoding to assume when the document does not declare one. */
    defaultPositionEncoding: PositionEncoding;
    /**
     * Returns the source text of a file (relative to the project root), used to
     * convert non UTF-16 positions. Only called when conversion is required.
     */
    readSource: (relativePath: string) => string | undefined;
}

export const parseDocument = (document: Document, { defaultPositionEncoding, readSource }: ParseDocumentOptions): ParsedDocument => {
    const filePath = document.relativePath.replace(/^\.?\//, '');
    const encoding = document.positionEncoding === PositionEncoding.UnspecifiedPositionEncoding
        ? defaultPositionEncoding
        : document.positionEncoding;

    let lines: string[] | undefined;
    const getLine = (lineNumber: number): string | undefined => {
        if (lines === undefined) {
            const text = document.text || readSource(filePath);
            lines = text ? text.split('\n') : [];
        }
        return lines[lineNumber];
    }

    const convert = (line: number, character: number): number => {
        if (encoding === PositionEncoding.UTF16CodeUnitOffsetFromLineStart) {
            return character;
        }
        const lineText = getLine(line);
        if (lineText === undefined || !NON_ASCII_REGEX.test(lineText)) {
            return character;
        }
        return encoding === PositionEncoding.UTF8CodeUnitOffsetFromLineStart
            ? utf8OffsetToUtf16(lineText, character)
            : utf32OffsetToUtf16(lineText, character);
    }

    const occurrences: OccurrenceRow[] = [];
    for (const occurrence of document.occurrences) {
        if (!occurrence.symbol) {
            continue;
        }
        const range = normalizeRange(occurrence);
        if (!range) {
            continue;
        }
        const [startLine, startChar, endLine, endChar] = range;
        occurrences.push({
            filePath,
            symbol: occurrence.symbol,
            roles: occurrence.symbolRoles,
            startLine,
            startChar: convert(startLine, startChar),
            endLine,
            endChar: convert(endLine, endChar),
        });
    }

    const symbols = document.symbols
        .map(formatSymbolInformation)
        .filter((symbol): symbol is SymbolRow => symbol !== undefined);

    return {
        filePath,
        occurrences,
        symbols,
    };
}

export const parseExternalSymbols = (index: Index): SymbolRow[] => {
    return index.externalSymbols
        .map(formatSymbolInformation)
        .filter((symbol): symbol is SymbolRow => symbol !== undefined);
}
