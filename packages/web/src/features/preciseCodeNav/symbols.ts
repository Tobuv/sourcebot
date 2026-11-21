/**
 * Helpers for working with SCIP symbol strings.
 *
 * Grammar: <scheme> ' ' <manager> ' ' <package-name> ' ' <version> ' ' <descriptors>
 * where spaces inside a field are escaped as two spaces.
 *
 * @see https://github.com/scip-code/scip/blob/main/scip.proto
 */

export const isLocalSymbol = (symbol: string) => symbol.startsWith('local ');

/**
 * Returns the (raw, still escaped) part of the symbol before and after the version
 * field. Used to match the same symbol across different versions of a package
 * (e.g. a library referenced at v1.2.0 from another indexed repository).
 */
export const getVersionlessSymbolParts = (symbol: string): { prefix: string, suffix: string } | undefined => {
    if (isLocalSymbol(symbol)) {
        return undefined;
    }

    // Find the index of the separator spaces between the 5 fields.
    const separators: number[] = [];
    let i = 0;
    while (i < symbol.length && separators.length < 4) {
        if (symbol[i] === ' ') {
            if (symbol[i + 1] === ' ') {
                i += 2;
                continue;
            }
            separators.push(i);
        }
        i += 1;
    }

    if (separators.length < 4) {
        return undefined;
    }

    return {
        // Everything up to and including the space before the version.
        prefix: symbol.slice(0, separators[2] + 1),
        // Everything from the space after the version.
        suffix: symbol.slice(separators[3]),
    };
}

/** Escapes a string for use in a SQL LIKE pattern (with '\' as the escape character). */
export const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
