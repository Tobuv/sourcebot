'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useSyntaxGuide } from "./syntaxGuideProvider";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { ExternalLinkIcon, RegexIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const LINGUIST_LINK = "https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml";
const CTAGS_LINK = "https://ctags.io/";

export const SyntaxReferenceGuide = () => {
    const t = useTranslations('syntaxGuide');
    const rich = {
    code: (chunks: React.ReactNode) => <CodeSnippet>{chunks}</CodeSnippet>,
    b: (chunks: React.ReactNode) => <b>{chunks}</b>,
    };
    const { isOpen, onOpenChanged } = useSyntaxGuide();
    const previousFocusedElement = useRef<HTMLElement | null>(null);

    const openDialog = useCallback(() => {
        previousFocusedElement.current = document.activeElement as HTMLElement;
        onOpenChanged(true);
    }, [onOpenChanged]);

    const closeDialog = useCallback(() => {
        onOpenChanged(false);

        // @note: Without requestAnimationFrame, focus was not being returned
        // to codemirror elements for some reason.
        requestAnimationFrame(() => {
            previousFocusedElement.current?.focus();
        });
    }, [onOpenChanged]);

    const handleOpenChange = useCallback((isOpen: boolean) => {
        if (isOpen) {
            openDialog();
        } else {
            closeDialog();
        }
    }, [closeDialog, openDialog]);

    useHotkeys("mod+/", (event) => {
        event.preventDefault();
        handleOpenChange(!isOpen);
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: t('open'),
    });

    return (
        <Dialog
            open={isOpen}
            onOpenChange={handleOpenChange}
        >
            <DialogContent
                className="max-h-[80vh] max-w-[700px] overflow-scroll gap-2"
            >
                <DialogHeader>
                    <DialogTitle>{t('title')} <Link href="https://docs.sourcebot.dev/docs/features/search/syntax-reference"><ExternalLinkIcon className="inline w-4 h-4 ml-1 mb-1 text-muted-foreground cursor-pointer" /></Link></DialogTitle>
                    <DialogDescription className="text-sm text-foreground">
                        {t('intro')}
                    </DialogDescription>
                </DialogHeader>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">{t('keyword.title')}</h3>
                    <p className="text-sm mb-2 mt-0">
                        {t.rich('keyword.intro', rich)}
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="py-2">{t('example')}</TableHead>
                                <TableHead className="py-2">{t('explanation')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('keyword.single', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('keyword.both', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{`"foo bar"`}</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('keyword.phrase', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{'"foo \\"bar\\""'}</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('keyword.escaped', rich)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <Separator className="my-4"/>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">{t('regex.title')}</h3>
                    <p className="text-sm mb-2 mt-0">
                        {t.rich('regex.intro', { icon: () => <RegexIcon className="inline w-4 h-4 align-middle mx-0.5 border rounded px-0.5 py-0.5" /> })}
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="py-2">{t('example')}</TableHead>
                                <TableHead className="py-2">{t('explanation')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('regex.simple', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo.*bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('regex.wildcard', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{`^function\\s+\\w+`}</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('regex.function', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{`"foo bar"`}</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('regex.quotes', rich)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <Separator className="my-4"/>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">{t('filters.title')}</h3>
                    <p className="text-sm mb-2 mt-0">
                        {t.rich('filters.intro', rich)}
                    </p>

                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="py-2">{t('prefix')}</TableHead>
                            <TableHead className="py-2">{t('description')}</TableHead>
                            <TableHead className="py-2 w-[175px]">{t('example')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>file:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">{t('filters.file')}</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title={t('filters.fileReadme')}
                                    >
                                        <Highlight>file:</Highlight>README
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title={t('filters.fileMyFile')}
                                    >
                                        <Highlight>file:</Highlight>{`"my file"`}
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title={t('filters.fileNegated')}
                                    >
                                        <Highlight>-file:</Highlight>test\.ts$
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>repo:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">{t('filters.repo')}</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title={t('filters.repoLinux')}
                                    >
                                        <Highlight>repo:</Highlight>linux
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title={t('filters.repoNegated')}
                                    >
                                        <Highlight>-repo:</Highlight>^web/.*
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>rev:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">{t.rich('filters.rev', rich)}</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title={t('filters.revBeta')}
                                    >
                                        <Highlight>rev:</Highlight>beta
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>lang:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">{t.rich('filters.lang', { link: (chunks) => <Link className="text-blue-500" href={LINGUIST_LINK}>{chunks}</Link> })}</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title={t('filters.langTypeScript')}
                                    >
                                        <Highlight>lang:</Highlight>TypeScript
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title={t('filters.langNegated')}
                                    >
                                        <Highlight>-lang:</Highlight>YAML
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>sym:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">{t.rich('filters.sym', { link: (chunks) => <Link className="text-blue-500" href={CTAGS_LINK}>{chunks}</Link> })}</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title={t('filters.symMain')}
                                    >
                                        <Highlight>sym:</Highlight>\bmain\b
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                    </Table>
                </div>

                <Separator className="my-4"/>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">{t('boolean.title')}</h3>
                    <p className="text-sm mb-2 mt-0">
                        {t.rich('boolean.intro', rich)}
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="py-2">{t('example')}</TableHead>
                                <TableHead className="py-2">{t('explanation')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo <Highlight>or</Highlight> bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('boolean.or', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo (bar <Highlight>or</Highlight> baz)</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('boolean.group', rich)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>-(foo) bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">{t.rich('boolean.not', rich)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}

const Highlight = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-highlight">
            {children}
        </span>
    )
}
