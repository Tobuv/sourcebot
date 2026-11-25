"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { useRouter } from "next/navigation"
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants"
import { useTranslations } from "next-intl"

export default function VerificationFailed() {
  const router = useRouter()
  const t = useTranslations('login')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111318] text-white">
      <div className="w-full max-w-md rounded-lg bg-[#1A1D24] p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <SourcebotLogo />
        </div>

        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <p className="mb-2 text-center text-lg font-medium">{t('verificationFailedTitle')}</p>
          <p className="text-center text-sm text-gray-400">
            {t('verificationFailedDescription')}
          </p>
        </div>

        <Button onClick={() => router.push("/login")} className="w-full bg-purple-600 hover:bg-purple-700">
          {t('returnToLogin')}
        </Button>
      </div>

      <div className="mt-8 flex gap-6 text-sm text-gray-500">
        <a href="https://www.sourcebot.dev" className="hover:text-gray-300">
          {t('about')}
        </a>
        <a href={`mailto:${SOURCEBOT_SUPPORT_EMAIL}`} className="hover:text-gray-300">
          {t('contactUs')}
        </a>
      </div>
    </div>
  )
}
