import { parse, TYPE, MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, test } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";
import { locales, matchAcceptLanguage } from "./config";

type Messages = { [key: string]: string | Messages };

const flatten = (messages: Messages, prefix = ''): Record<string, string> => {
    return Object.entries(messages).reduce<Record<string, string>>((acc, [key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
            acc[path] = value;
        } else {
            Object.assign(acc, flatten(value, path));
        }
        return acc;
    }, {});
}

/** Collects argument and tag names used by a message. */
const collectNames = (elements: MessageFormatElement[], names = new Set<string>()) => {
    for (const element of elements) {
        switch (element.type) {
            case TYPE.argument:
            case TYPE.number:
            case TYPE.date:
            case TYPE.time:
                names.add(`{${element.value}}`);
                break;
            case TYPE.plural:
            case TYPE.select:
                names.add(`{${element.value}}`);
                for (const option of Object.values(element.options)) {
                    collectNames(option.value, names);
                }
                break;
            case TYPE.tag:
                names.add(`<${element.value}>`);
                collectNames(element.children, names);
                break;
        }
    }
    return names;
}

const flatEn = flatten(en);
const flatZh = flatten(zh);

describe("messages", () => {
    test("every locale has a messages file", () => {
        expect(locales).toEqual(['en', 'zh']);
    });

    test("zh and en have the same keys", () => {
        const missingInZh = Object.keys(flatEn).filter((key) => !(key in flatZh));
        const extraInZh = Object.keys(flatZh).filter((key) => !(key in flatEn));
        expect({ missingInZh, extraInZh }).toEqual({ missingInZh: [], extraInZh: [] });
    });

    test.each(Object.keys(flatEn))("%s is valid ICU and consistent across locales", (key) => {
        const enNames = collectNames(parse(flatEn[key]));
        const zhNames = collectNames(parse(flatZh[key]));

        // Tags (e.g. `<link>`) are rendered by the caller via `t.rich`, so every
        // locale must use exactly the same set.
        const tags = (names: Set<string>) => [...names].filter((name) => name.startsWith('<')).sort();
        expect(tags(zhNames)).toEqual(tags(enNames));

        // A translation may omit arguments (e.g. one only used for English plurals),
        // but must not use arguments the caller doesn't pass.
        const args = (names: Set<string>) => [...names].filter((name) => name.startsWith('{'));
        const unknown = args(zhNames).filter((name) => !enNames.has(name));
        expect(unknown).toEqual([]);
    });
});

describe("matchAcceptLanguage", () => {
    test.each([
        ["zh-CN,zh;q=0.9,en;q=0.8", "zh"],
        ["en-US,en;q=0.9,zh-CN;q=0.8", "en"],
        ["zh-TW", "zh"],
        ["fr-FR,fr;q=0.9,zh;q=0.5", "zh"],
        ["fr-FR", undefined],
        ["", undefined],
        [null, undefined],
        ["en;q=0,zh", "zh"],
    ])("%s -> %s", (header, expected) => {
        expect(matchAcceptLanguage(header)).toBe(expected);
    });
});
