import { create, toBinary } from "@bufbuild/protobuf";
import {
    DocumentSchema,
    IndexSchema,
    OccurrenceSchema,
    PositionEncoding,
    SymbolInformation_Kind,
    SymbolInformationSchema,
    SymbolRole,
} from "@scip-code/scip";
import { describe, expect, test } from "vitest";
import {
    decodeScipIndex,
    getSymbolName,
    parseDocument,
    parseExternalSymbols,
    splitSymbol,
    utf32OffsetToUtf16,
    utf8OffsetToUtf16,
} from "./parse";

describe("getSymbolName", () => {
    test.each([
        ["scip-typescript npm pkg 1.0.0 src/`foo.ts`/Foo#bar().", "bar"],
        ["scip-typescript npm pkg 1.0.0 src/`foo.ts`/Foo#", "Foo"],
        ["scip-typescript npm pkg 1.0.0 src/`foo.ts`/Foo#value.", "value"],
        ["scip-go gomod github.com/a/b 123 `github.com/a/b/pkg`/Server#Start().", "Start"],
        ["scip-go gomod github.com/a/b 123 `github.com/a/b/pkg`/", "github.com/a/b/pkg"],
        ["semanticdb maven . . com/x/Y#z(+1).", "z"],
        ["scip-python python proj 1 mod/Klass#method().(arg)", "arg"],
        ["scip-typescript npm pkg 1.0.0 src/`foo.ts`/identity().[T]", "T"],
        ["rust-analyzer cargo std 1.0 macros/println!", "println"],
        ["local 4", ""],
        ["not-a-symbol", ""],
    ])("%s -> %s", (symbol, expected) => {
        expect(getSymbolName(symbol)).toBe(expected);
    });
});

describe("splitSymbol", () => {
    test("handles escaped spaces in the package name", () => {
        expect(splitSymbol("scip-ts npm my  pkg 1.0 a/b#")).toEqual({
            scheme: "scip-ts",
            manager: "npm",
            packageName: "my pkg",
            version: "1.0",
            descriptors: "a/b#",
        });
    });

    test("returns undefined for local symbols", () => {
        expect(splitSymbol("local 1")).toBeUndefined();
    });
});

describe("offset conversion", () => {
    test("utf8 byte offsets", () => {
        // "é" is 2 bytes in UTF-8 and 1 UTF-16 code unit.
        expect(utf8OffsetToUtf16("é = foo", 3)).toBe(2);
        // "😀" is 4 bytes in UTF-8 and 2 UTF-16 code units.
        expect(utf8OffsetToUtf16("😀 x", 5)).toBe(3);
        expect(utf8OffsetToUtf16("abc", 2)).toBe(2);
    });

    test("utf32 code point offsets", () => {
        expect(utf32OffsetToUtf16("😀 x", 2)).toBe(3);
    });
});

describe("parseDocument", () => {
    const makeIndex = () => create(IndexSchema, {
        documents: [
            create(DocumentSchema, {
                relativePath: "src/main.go",
                occurrences: [
                    // Deprecated 3-element range.
                    create(OccurrenceSchema, {
                        range: [1, 5, 8],
                        symbol: "scip-go gomod m 1 pkg/Foo().",
                        symbolRoles: SymbolRole.Definition,
                    }),
                    // Typed multi line range after non-ascii text.
                    create(OccurrenceSchema, {
                        typedRange: {
                            case: "multiLineRange",
                            value: { startLine: 2, startCharacter: 10, endLine: 3, endCharacter: 1 },
                        },
                        symbol: "local 0",
                        symbolRoles: SymbolRole.ReadAccess,
                    }),
                    // Occurrences without a symbol are dropped.
                    create(OccurrenceSchema, { range: [0, 0, 1] }),
                ],
                symbols: [
                    create(SymbolInformationSchema, {
                        symbol: "scip-go gomod m 1 pkg/Foo().",
                        documentation: ["```go\nfunc Foo()\n```", "Foo does things."],
                        kind: SymbolInformation_Kind.Function,
                    }),
                    create(SymbolInformationSchema, { symbol: "local 0" }),
                ],
            }),
        ],
        externalSymbols: [
            create(SymbolInformationSchema, {
                symbol: "scip-go gomod std 1 fmt/Println().",
                documentation: ["Println prints."],
            }),
        ],
    });

    test("round trips through the binary format and normalizes ranges", () => {
        const index = decodeScipIndex(toBinary(IndexSchema, makeIndex()));
        const source = "package pkg\nfunc Foo() {}\n// é → x\n}";

        const parsed = parseDocument(index.documents[0], {
            defaultPositionEncoding: PositionEncoding.UTF8CodeUnitOffsetFromLineStart,
            readSource: (relativePath) => relativePath === "src/main.go" ? source : undefined,
        });

        expect(parsed.filePath).toBe("src/main.go");
        expect(parsed.occurrences).toEqual([
            {
                filePath: "src/main.go",
                symbol: "scip-go gomod m 1 pkg/Foo().",
                roles: SymbolRole.Definition,
                startLine: 1, startChar: 5, endLine: 1, endChar: 8,
            },
            {
                filePath: "src/main.go",
                symbol: "local 0",
                roles: SymbolRole.ReadAccess,
                // "// é → " is 10 bytes but 7 UTF-16 code units.
                startLine: 2, startChar: 7, endLine: 3, endChar: 1,
            },
        ]);

        expect(parsed.symbols).toEqual([
            {
                symbol: "scip-go gomod m 1 pkg/Foo().",
                name: "Foo",
                displayName: null,
                kind: "Function",
                signature: "func Foo()",
                documentation: "Foo does things.",
            },
        ]);

        expect(parseExternalSymbols(index).map((symbol) => symbol.name)).toEqual(["Println"]);
    });

    test("does not convert UTF-16 positions", () => {
        const index = makeIndex();
        const parsed = parseDocument(index.documents[0], {
            defaultPositionEncoding: PositionEncoding.UTF16CodeUnitOffsetFromLineStart,
            readSource: () => { throw new Error("should not read the source"); },
        });
        expect(parsed.occurrences[1].startChar).toBe(10);
    });
});
