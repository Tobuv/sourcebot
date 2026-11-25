import { getFormattedDate } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "next-intl"
import { getIntlLocale } from "@/i18n/dateLocale"

const formatFullDate = (date: Date, locale: string) => {
    return new Intl.DateTimeFormat(locale, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    }).format(date)
}

interface DisplayDateProps {
    date: Date
    className?: string
}

export const DisplayDate = ({ date, className }: DisplayDateProps) => {
    const intlLocale = getIntlLocale(useLocale());
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={className}>
                        {getFormattedDate(date, intlLocale)}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{formatFullDate(date, intlLocale)}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}