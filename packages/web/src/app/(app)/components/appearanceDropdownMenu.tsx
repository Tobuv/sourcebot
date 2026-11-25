import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings2Icon } from "lucide-react"
import { AppearanceDropdownMenuGroup } from "./appearanceDropdownMenuGroup"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTranslations } from "next-intl"

interface AppearanceDropdownMenuProps {
    className?: string;
}

export const AppearanceDropdownMenu = ({ className }: AppearanceDropdownMenuProps) => {
    const t = useTranslations('appearance');
    return (
        <DropdownMenu>
            <Tooltip
                delayDuration={100}
            >
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className={className}>
                            <Settings2Icon className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {t('settings')}
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
                <AppearanceDropdownMenuGroup />
            </DropdownMenuContent>
        </DropdownMenu>
    )
}