"use client"

import { setAgenticSearchTutorialDismissedCookie } from "@/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ModelProviderLogo } from "@/features/chat/components/chatBox/modelProviderLogo"
import { cn } from "@/lib/utils"
import mentionsDemo from "@/public/ask_sb_tutorial_at_mentions.png"
import citationsDemo from "@/public/ask_sb_tutorial_citations.png"
import searchScopeDemo from "@/public/ask_sb_tutorial_search_scope.png"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import {
    ArrowLeftRightIcon,
    AtSignIcon,
    BookMarkedIcon,
    BookTextIcon,
    ChevronLeft,
    ChevronRight,
    CircleCheckIcon,
    FileIcon,
    FolderIcon,
    GitCommitHorizontalIcon,
    LibraryBigIcon,
    ScanSearchIcon,
    TicketIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { useTranslations } from "next-intl"






type TutorialTranslator = ReturnType<typeof useTranslations<'chatTutorial'>>;

const getTutorialSteps = (t: TutorialTranslator) => [
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 justify-between gap-4">
                <div className="flex flex-col gap-6">
                    <h2 className="text-5xl font-bold leading-tight">
                        Ask Source<span className="text-[#851EE6]">bot.</span>
                    </h2>
                    <p className="text-lg">
                        {t.rich('intro', { b: (chunks) => <span className="font-bold">{chunks}</span> })}
                    </p>
                    <p className="text-md text-muted-foreground">
                        {t.rich('introDetails', { link: (chunks) => <Link href="https://docs.sourcebot.dev/docs/configuration/language-model-providers" className="underline">{chunks}</Link> })}
                    </p>
                </div>
                <div className="space-y-3 mx-auto flex flex-wrap justify-center gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <ModelProviderLogo provider="anthropic" />
                        <ModelProviderLogo provider="openai" />
                        <ModelProviderLogo provider="google-generative-ai" />
                        <ModelProviderLogo provider="amazon-bedrock" />
                        <ModelProviderLogo provider="azure" />
                        <ModelProviderLogo provider="deepseek" />
                        <ModelProviderLogo provider="mistral" />
                        <ModelProviderLogo provider="openrouter" />
                        <ModelProviderLogo provider="xai" />
                    </div>
                </div>
            </div>
        ),
        rightContent: (
            <video
                src="https://www.dropbox.com/scl/fi/htbvyj0u7qjr0j78tyqiq/ask_tutorial_hero.mp4?rlkey=1e2a69njwtzt632pwqky9fen9&st=juaf8qq6&raw=1"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
            />
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <ScanSearchIcon className="inline-block h-8 w-8 text-primary" />
                    {t('scopesTitle')}
                </h2>
                <p className="text-lg">
                    {t('scopesIntro')}
                </p>

                <div className="flex flex-col mb-2 text-muted-foreground">
                    <p className="mb-4">{t('scopesTypes')}</p>
                    <div className="flex gap-2 mb-2">
                        <BookMarkedIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        <span>{t.rich('scopeRepository', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                    </div>
                    <div className="flex gap-2">
                        <LibraryBigIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        <span>{t.rich('scopeReposet', { b: (chunks) => <strong>{chunks}</strong>, link: (chunks) => <Link href="https://docs.sourcebot.dev/docs/features/search/search-contexts" className="underline">{chunks}</Link> })}</span>
                    </div>
                </div>
            </div>
        ),
        rightContent: (
            <Image
                src={searchScopeDemo}
                alt={t('scopeDemoAlt')}
                className="w-full h-full object-cover"
            />
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <AtSignIcon className="inline-block h-8 w-8 text-primary" />
                    {t('mentionsTitle')}
                </h2>
                <p className="text-lg">
                    {t.rich('mentionsIntro', { icon: () => <FileIcon className="inline-block h-4 w-4 mb-1 ml-0.5" /> })}
                </p>

                <div className="flex flex-col">
                    <p className="mb-3 text-muted-foreground"><strong>{t('comingSoon')}</strong></p>
                    <div className="space-y-2 text-muted-foreground">
                        <div className="flex gap-2">
                            <FolderIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span>{t.rich('mentionDirectories', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                        </div>
                        <div className="flex gap-2">
                            <GitCommitHorizontalIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span>{t.rich('mentionCommits', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                        </div>
                        <div className="flex gap-2">
                            <BookTextIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span>{t.rich('mentionDocs', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                        </div>
                        <div className="flex gap-2">
                            <TicketIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span>{t.rich('mentionIssues', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                        </div>
                    </div>
                </div>
            </div>
        ),
        rightContent: (
            <Image
                src={mentionsDemo}
                alt={t('mentionsDemoAlt')}
                className="w-full h-full object-cover"
            />
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <ArrowLeftRightIcon className="inline-block h-8 w-8 text-primary" />
                    {t('citationsTitle')}
                </h2>
                <p className="text-lg">
                    {t('citationsIntro')}
                </p>
            </div>
        ),
        rightContent: (
            <Image
                src={citationsDemo}
                alt={t('citationsDemoAlt')}
                className="w-full h-full object-cover"
            />
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <CircleCheckIcon className="inline-block h-8 w-8 text-primary" />
                    {t('allSetTitle')}
                </h2>
                <p className="text-lg">
                    {t.rich('allSetIntro', { link: (chunks) => <Link href="https://docs.sourcebot.dev/docs/features/ask/overview" className="underline">{chunks}</Link> })}
                </p>
                <p className="text-lg">
                    {t.rich('hitBug', { b: (chunks) => <span className="font-bold">{chunks}</span>, link: (chunks) => <Link href="https://github.com/sourcebot-dev/sourcebot/issues" className="underline">{chunks}</Link> })}
                </p>
                <p className="text-lg">
                    {t.rich('featureRequest', { b: (chunks) => <span className="font-bold">{chunks}</span>, link: (chunks) => <Link href="https://github.com/sourcebot-dev/sourcebot/discussions" className="underline">{chunks}</Link> })}
                </p>
                <p className="text-lg">
                    {t.rich('anythingElse', { b: (chunks) => <span className="font-bold">{chunks}</span>, link: (chunks) => <Link href="https://www.sourcebot.dev/contact" className="underline">{chunks}</Link> })}
                </p>
            </div>
        ),
        rightContent: (
            <div className="flex flex-col h-full justify-center items-center gap-6 bg-[#020817]">
                <SourcebotLogo size="small" className="h-[150px] w-[150px] text-white" />
            </div>
        ),
    },
]

interface TutorialDialogProps {
    isOpen: boolean;
}

export const TutorialDialog = ({ isOpen: _isOpen }: TutorialDialogProps) => {
    const t = useTranslations('chatTutorial');
    const tutorialSteps = useMemo(() => getTutorialSteps(t), [t]);
    const [isOpen, setIsOpen] = useState(_isOpen);
    const onClose = useCallback(() => {
        setIsOpen(false);
        setAgenticSearchTutorialDismissedCookie(true);
    }, []);

    const [currentStep, setCurrentStep] = useState(0)

    const nextStep = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const isLastStep = currentStep === tutorialSteps.length - 1
    const isFirstStep = currentStep === 0
    const currentStepData = tutorialSteps[currentStep];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="sm:max-w-[900px] p-0 flex flex-col h-[525px] overflow-hidden rounded-xl border-none bg-transparent"
                closeButtonClassName="text-white"
            >
                <DialogTitle className="sr-only">{t('dialogTitle')}</DialogTitle>
                <div className="relative flex h-full">
                    {/* Left Column (Text Content & Navigation) */}
                    <div className="flex-1 flex flex-col justify-between bg-background">
                        <div className="p-4 flex-1 overflow-y-auto">
                            {currentStepData.leftContent}
                        </div>

                        {/* Fixed bottom navigation for left column */}
                        <div className="border-t p-6 flex items-center justify-between">
                            {/* Left side: Previous button container */}
                            <div className="w-36 flex justify-start">
                                <Button
                                    variant="ghost"
                                    onClick={prevStep}
                                    className={cn(
                                        "flex items-center gap-2",
                                        isFirstStep && "opacity-0 pointer-events-none"
                                    )}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    {t('previous')}
                                </Button>
                            </div>

                            {/* Center: Progress dots */}
                            <div className="flex gap-2">
                                {tutorialSteps.map((_, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-colors",
                                            index === currentStep ? "bg-primary" : "bg-muted"
                                        )}
                                    />
                                ))}
                            </div>

                            {/* Right side: Next/Start/Get Started button container */}
                            <div className="w-36 flex justify-end">
                                {isLastStep ? (
                                    <Button onClick={onClose}>
                                        {t('getStarted')}
                                    </Button>
                                ) : (
                                    <Button onClick={nextStep}>
                                        {t('next')}
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Image/Visual Content) */}
                    <div className="flex-1 flex flex-col justify-between bg-[#020817]">
                        <div className="flex-1 overflow-y-auto">{currentStepData.rightContent}</div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

