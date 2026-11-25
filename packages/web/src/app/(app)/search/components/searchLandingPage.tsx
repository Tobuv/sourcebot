import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { NavigationMenu } from "../../components/navigationMenu"
import { RepositoryCarousel } from "../../components/repositoryCarousel"
import { Separator } from "@/components/ui/separator"
import { SyntaxReferenceGuideHint } from "../../components/syntaxReferenceGuideHint"
import Link from "next/link"
import { SearchBar } from "../../components/searchBar"
import { SearchModeSelector } from "../../components/searchModeSelector"
import { getRepos, getReposStats } from "@/actions"
import { ServiceErrorException } from "@/lib/serviceError"
import { isServiceError } from "@/lib/utils"

import { getTranslations } from "next-intl/server"
export interface SearchLandingPageProps {
    isSearchAssistSupported: boolean;
}

export const SearchLandingPage = async ({
    isSearchAssistSupported,
}: SearchLandingPageProps) => {
    const t = await getTranslations('search');
    const carouselRepos = await getRepos({
        where: {
            indexedAt: {
                not: null,
            },
        },
        take: 10,
    });

    const repoStats = await getReposStats();

    if (isServiceError(carouselRepos)) throw new ServiceErrorException(carouselRepos);
    if (isServiceError(repoStats)) throw new ServiceErrorException(repoStats);

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu />

            <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-16 w-full px-5">
                <div className="max-h-44 w-auto">
                    <SourcebotLogo
                        className="h-18 md:h-40 w-auto"
                    />
                </div>
                <div className="mt-4 w-full max-w-[800px] border rounded-md shadow-sm">
                    <SearchBar
                        autoFocus={true}
                        className="border-none pt-0.5 pb-0"
                        isSearchAssistSupported={isSearchAssistSupported}
                    />
                    <Separator />
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <SearchModeSelector
                            searchMode="precise"
                            className="ml-auto"
                        />
                    </div>
                </div>

                <div className="mt-8">
                    <RepositoryCarousel
                        numberOfReposWithIndex={repoStats.numberOfReposWithIndex}
                        displayRepos={carouselRepos}
                    />
                </div>

                <div className="flex flex-col items-center w-fit gap-6">
                    <Separator className="mt-5" />
                    <span className="font-semibold">{t('howToSearch')}</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <HowToSection
                            title={t('howTo.files')}
                        >
                            <QueryExample>
                                <Query query="test todo">test todo</Query> <QueryExplanation>{t('howTo.both')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="test or todo">test <Highlight>or</Highlight> todo</Query> <QueryExplanation>{t('howTo.either')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query={`"exit boot"`}>{`"exit boot"`}</Query> <QueryExplanation>{t('howTo.exact')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="TODO" isCaseSensitivityEnabled={true}>TODO</Query> <QueryExplanation>{t('howTo.caseSensitive')}</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title={t('howTo.filter')}
                        >
                            <QueryExample>
                                <Query query="file:README setup"><Highlight>file:</Highlight>README setup</Query> <QueryExplanation>{t('howTo.byFilename')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="repo:torvalds/linux test"><Highlight>repo:</Highlight>torvalds/linux test</Query> <QueryExplanation>{t('howTo.byRepo')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="lang:TypeScript"><Highlight>lang:</Highlight>TypeScript</Query> <QueryExplanation>{t('howTo.byLanguage')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="rev:HEAD"><Highlight>rev:</Highlight>HEAD</Query> <QueryExplanation>{t('howTo.byRevision')}</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title={t('howTo.advanced')}
                        >
                            <QueryExample>
                                <Query query="file:\.py$"><Highlight>file:</Highlight>{`\\.py$`}</Query> <QueryExplanation>{t('howTo.pyFiles')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="sym:main"><Highlight>sym:</Highlight>main</Query> <QueryExplanation>{t('howTo.symbolsNamedMain')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="todo -lang:c">todo <Highlight>-lang:c</Highlight></Query> <QueryExplanation>{t('howTo.negate')}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="content:README"><Highlight>content:</Highlight>README</Query> <QueryExplanation>{t('howTo.contentOnly')}</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                    </div>
                    <SyntaxReferenceGuideHint />
                </div>
            </div>
        </div>
    )
}

const HowToSection = ({ title, children }: { title: string, children: React.ReactNode }) => {
    return (
        <div className="flex flex-col gap-1">
            <span className="dark:text-gray-300 text-sm mb-2 underline">{title}</span>
            {children}
        </div>
    )

}

const Highlight = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-highlight">
            {children}
        </span>
    )
}

const QueryExample = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-sm font-mono">
            {children}
        </span>
    )
}

const QueryExplanation = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-gray-500 dark:text-gray-400 ml-3">
            {children}
        </span>
    )
}

const Query = ({ query, children, isCaseSensitivityEnabled = false }: { query: string, children: React.ReactNode, isCaseSensitivityEnabled?: boolean }) => {
    return (
        <Link
            href={`/search?query=${query}${isCaseSensitivityEnabled ? "&isCaseSensitivityEnabled=true" : ""}`}
            className="cursor-pointer hover:underline"
        >
            {children}
        </Link>
    )
}