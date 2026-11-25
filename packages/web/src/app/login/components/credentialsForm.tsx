'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { verifyCredentialsRequestSchema } from "@/lib/schemas";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface CredentialsFormProps {
    callbackUrl?: string;
    context: "login" | "signup";
}

export const CredentialsForm = ({ callbackUrl, context }: CredentialsFormProps) => {
    const t = useTranslations('login');
    const [isLoading, setIsLoading] = useState(false);
    const form = useForm<z.infer<typeof verifyCredentialsRequestSchema>>({
        resolver: zodResolver(verifyCredentialsRequestSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = (values: z.infer<typeof verifyCredentialsRequestSchema>) => {
        setIsLoading(true);
        signIn("credentials", {
            email: values.email,
            password: values.password,
            redirectTo: callbackUrl ?? "/"
        })
        .catch(() => {
            setIsLoading(false);
        });
        // signIn will redirect on success, so don't set isLoading to false
    }

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full"
            >
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="mb-4">
                            <FormLabel>{t('email')}</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="email@example.com"
                                    autoComplete="email"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem className="mb-8">
                            <FormLabel>{t('password')}</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    autoComplete={context === "signup" ? "new-password" : "current-password"}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : ""}
                    {context === "login" ? t('signInWithCredentials') : t('signUpWithCredentials')}
                </Button>
            </form>
        </Form>
    );
} 