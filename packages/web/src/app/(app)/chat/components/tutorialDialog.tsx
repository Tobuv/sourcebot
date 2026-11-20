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
import { useCallback, useState } from "react"






const tutorialSteps = [
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 justify-between gap-4">
                <div className="flex flex-col gap-6">
                    <h2 className="text-5xl font-bold leading-tight">
                        Ask Source<span className="text-[#851EE6]">bot.</span>
                    </h2>
                    <p className="text-lg">
                        Ask questions about your <span className="font-bold">entire codebase</span> in natural language.
                        Get back responses grounded in code with <span className="font-bold">inline citations</span>.
                    </p>
                    <p className="text-md text-muted-foreground">
                        Ask NexusCode is an agentic search tool that can answer questions about your codebase by searching, reading files, navigating references, and more. Supports any <Link href="https://docs.sourcebot.dev/docs/configuration/language-model-providers" className="underline">compatible LLM.</Link>
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
                    Search Scopes
                </h2>
                <p className="text-lg">
                    {`When asking NexusCode a question, you can select one or more scopes to focus the search.`}
                </p>

                <div className="flex flex-col mb-2 text-muted-foreground">
                    <p className="mb-4">There are two types of search scopes:</p>
                    <div className="flex gap-2 mb-2">
                        <BookMarkedIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        <span><strong>Repository</strong>: A single repository.</span>
                    </div>
                    <div className="flex gap-2">
                        <LibraryBigIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        <span><strong>Reposet</strong>: A collection of repositories (<Link href="https://docs.sourcebot.dev/docs/features/search/search-contexts" className="underline">configuration docs</Link>).</span>
                    </div>
                </div>
            </div>
        ),
        rightContent: (
            <Image
                src={searchScopeDemo}
                alt="Search scope demo"
                className="w-full h-full object-cover"
            />
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <AtSignIcon className="inline-block h-8 w-8 text-primary" />
                    Mentions
                </h2>
                <p className="text-lg">
                    @ mention specific <FileIcon className="inline-block h-4 w-4 mb-1 ml-0.5" /> files to add them to the {`model's`} context. Suggestions will be scoped to the selected search scopes.
                </p>

                <div className="flex flex-col">
                    <p className="mb-3 text-muted-foreground"><strong>Coming soon</strong></p>
                    <div className="space-y-2 text-muted-foreground">
                        <div className="flex gap-2">
                            <FolderIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span><strong>Directories</strong>: Include entire folders as context</span>
                        </div>
                        <div className="flex gap-2">
                            <GitCommitHorizontalIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span><strong>Commits</strong>: Reference specific git commits</span>
                        </div>
                        <div className="flex gap-2">
                            <BookTextIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span><strong>Docs</strong>: Link to external docs and wikis</span>
                        </div>
                        <div className="flex gap-2">
                            <TicketIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                            <span><strong>Issues</strong>: GitHub issues, Jira tickets, and more</span>
                        </div>
                    </div>
                </div>
            </div>
        ),
        rightContent: (
            <Image
                src={mentionsDemo}
                alt="Mentions demo"
                className="w-full h-full object-cover"
            />
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <ArrowLeftRightIcon className="inline-block h-8 w-8 text-primary" />
                    Inline Citations
                </h2>
                <p className="text-lg">
                    {`NexusCode searches your codebase and provides responses with clickable citations that link directly to relevant sections of code.`}
                </p>
            </div>
        ),
        rightContent: (
            <Image
                src={citationsDemo}
                alt="Citations demo"
                className="w-full h-full object-cover"
            />
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <CircleCheckIcon className="inline-block h-8 w-8 text-primary" />
                    You&apos;re all set!
                </h2>
                <p className="text-lg">
                    You can now ask NexusCode any question about your codebase. Checkout the <Link href="https://docs.sourcebot.dev/docs/features/ask/overview" className="underline">docs</Link> for more information.
                </p>
                <p className="text-lg">
                    <span className="font-bold">Hit a bug?</span> Open up <Link href="https://github.com/sourcebot-dev/sourcebot/issues" className="underline">an issue</Link>.
                </p>
                <p className="text-lg">
                    <span className="font-bold">Feature request?</span> Open a <Link href="https://github.com/sourcebot-dev/sourcebot/discussions" className="underline">discussion</Link>.
                </p>
                <p className="text-lg">
                    <span className="font-bold">Anything else?</span> <Link href="https://www.sourcebot.dev/contact" className="underline">Contact us</Link>.
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
                <DialogTitle className="sr-only">Ask NexusCode tutorial</DialogTitle>
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
                                    Previous
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
                                        Get Started
                                    </Button>
                                ) : (
                                    <Button onClick={nextStep}>
                                        Next
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

