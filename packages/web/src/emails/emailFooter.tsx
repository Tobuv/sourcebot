import {
    Hr,
    Section,
    Text,
} from '@react-email/components';

export const EmailFooter = () => {
    return (
        <Section className="mt-[10px]">
            <Hr className="border border-solid border-[#eaeaea] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
                NexusCode, code search and understanding for your team.
            </Text>
        </Section>
    )
}