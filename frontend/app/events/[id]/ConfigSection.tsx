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

interface ConfigSectionProps {
    gameConfig: string;
    serverConfig: string;
    gameConfigHtml: string;
    serverConfigHtml: string;
}

export default function ConfigSection({
    gameConfig,
    serverConfig,
    gameConfigHtml,
    serverConfigHtml,
}: ConfigSectionProps) {
    const [copiedGame, setCopiedGame] = useState(false);
    const [copiedServer, setCopiedServer] = useState(false);

    const formatJson = (jsonString: string) => {
        try {
            return JSON.stringify(JSON.parse(jsonString), null, 2);
        } catch {
            return jsonString;
        }
    }

    const formattedGameConfig = formatJson(gameConfig);
    const formattedServerConfig = formatJson(serverConfig);

    const copyToClipboard = async (text: string, type: 'game' | 'server') => {
        await navigator.clipboard.writeText(text);
        if (type === 'game') {
            setCopiedGame(true);
            setTimeout(() => setCopiedGame(false), 2000);
        } else {
            setCopiedServer(true);
            setTimeout(() => setCopiedServer(false), 2000);
        }
    }

    return (
        <div>
            <h3 className="text-sm font-medium text-muted-foreground">
                Configuration
            </h3>
            <div className="mt-1 flex flex-col gap-2">
                <Dialog>
                    <DialogTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer group w-fit">
                            <Code2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-primary underline decoration-dashed underline-offset-4 text-sm">
                                Game Config
                            </span>
                        </div>
                    </DialogTrigger>
                    <DialogContent className="w-fit max-w-[80vw] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border border-border shadow-2xl [&>button]:text-foreground">
                        <DialogHeader className="p-4 bg-card border-b border-border flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="text-xl font-bold flex items-center gap-3 text-card-foreground">
                                <Code2 className="size-5 text-primary" />
                                Game Configuration
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="mr-8 hover:bg-muted shrink-0"
                                onClick={() => copyToClipboard(formattedGameConfig, 'game')}
                                title={copiedGame ? "Copied!" : "Copy Config"}
                            >
                                {copiedGame ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                            </Button>
                        </DialogHeader>
                        <div className="overflow-auto bg-background dark:bg-[#0d1117] px-4 border-t border-border">
                            <div
                                className="prose prose-slate dark:prose-invert prose-base max-w-none [&_pre]:p-0 [&_pre]:m-0 [&_pre]:bg-transparent [&_*:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: gameConfigHtml }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <DialogTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer group w-fit">
                            <Server className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-primary underline decoration-dashed underline-offset-4 text-sm">
                                Server Config
                            </span>
                        </div>
                    </DialogTrigger>
                    <DialogContent className="w-fit max-w-[80vw] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border border-border shadow-2xl [&>button]:text-foreground">
                        <DialogHeader className="p-4 bg-card border-b border-border flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="text-xl font-bold flex items-center gap-3 text-card-foreground">
                                <Server className="size-5 text-primary" />
                                Server Configuration
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="mr-8 hover:bg-muted shrink-0"
                                onClick={() => copyToClipboard(formattedServerConfig, 'server')}
                                title={copiedServer ? "Copied!" : "Copy Config"}
                            >
                                {copiedServer ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                            </Button>
                        </DialogHeader>
                        <div className="overflow-auto bg-background dark:bg-[#0d1117] px-4 border-t border-border">
                            <div
                                className="prose prose-slate dark:prose-invert prose-base max-w-none [&_pre]:p-0 [&_pre]:m-0 [&_pre]:bg-transparent [&_*:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: serverConfigHtml }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
