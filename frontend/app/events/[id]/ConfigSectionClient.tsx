"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Code2, Server, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ConfigDialogProps {
    title: string;
    icon: React.ReactNode;
    configHtml: string;
    rawConfig: string;
    label: string;
}

function ConfigDialog({ title, icon, configHtml, rawConfig, label }: ConfigDialogProps) {
    const [copied, setCopied] = useState(false);

    const formatJson = (jsonString: string) => {
        try {
            return JSON.stringify(JSON.parse(jsonString), null, 2);
        } catch {
            return jsonString;
        }
    }

    const copyToClipboard = async () => {
        const formatted = formatJson(rawConfig);
        await navigator.clipboard.writeText(formatted);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer group w-fit">
                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                        {icon}
                    </div>
                    <span className="text-primary underline decoration-dashed underline-offset-4 text-sm">
                        {label}
                    </span>
                </div>
            </DialogTrigger>
            <DialogContent className="w-fit max-w-[80vw] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border border-border shadow-2xl [&>button]:text-foreground">
                <DialogHeader className="p-4 bg-card border-b border-border flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-xl font-bold flex items-center gap-3 text-card-foreground">
                        {icon}
                        {title}
                    </DialogTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mr-8 hover:bg-muted shrink-0"
                        onClick={copyToClipboard}
                        title={copied ? "Copied!" : `Copy ${label}`}
                    >
                        {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                    </Button>
                </DialogHeader>
                <div className="overflow-auto bg-background dark:bg-[#0d1117] px-4 border-t border-border">
                    <div
                        className="prose prose-slate dark:prose-invert prose-base max-w-none [&_pre]:p-0 [&_pre]:m-0 [&_pre]:bg-transparent [&_*:last-child]:mb-0"
                        dangerouslySetInnerHTML={{ __html: configHtml }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface ConfigSectionClientProps {
    gameConfig: string;
    serverConfig: string;
    gameConfigHtml: string;
    serverConfigHtml: string;
}

export default function ConfigSectionClient({
    gameConfig,
    serverConfig,
    gameConfigHtml,
    serverConfigHtml,
}: ConfigSectionClientProps) {
    return (
        <div>
            <h3 className="text-sm font-medium text-muted-foreground">
                Configuration
            </h3>
            <div className="mt-1 flex flex-col gap-2">
                <ConfigDialog
                    title="Game Configuration"
                    label="Game Config"
                    icon={<Code2 className="size-4" />}
                    configHtml={gameConfigHtml}
                    rawConfig={gameConfig}
                />
                <ConfigDialog
                    title="Server Configuration"
                    label="Server Config"
                    icon={<Server className="size-4" />}
                    configHtml={serverConfigHtml}
                    rawConfig={serverConfig}
                />
            </div>
        </div>
    );
}
