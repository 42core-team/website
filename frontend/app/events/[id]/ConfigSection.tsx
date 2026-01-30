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
}

export default function ConfigSection({
    gameConfig,
    serverConfig,
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
                    <DialogContent className="w-fit max-w-[80vw] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl [&>button]:text-black">
                        <DialogHeader className="p-6 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                <Code2 className="size-6" />
                                Game Configuration
                            </DialogTitle>
                            <Button
                                variant="default"
                                size="icon"
                                className="mr-8 bg-black hover:bg-black/80 text-white border-none shrink-0"
                                onClick={() => copyToClipboard(formattedGameConfig, 'game')}
                                title={copiedGame ? "Copied!" : "Copy Config"}
                            >
                                {copiedGame ? <Check className="size-4" /> : <Copy className="size-4" />}
                            </Button>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto bg-[#0d1117]">
                            <pre className="font-mono text-sm text-white p-6">
                                {formattedGameConfig}
                            </pre>
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
                    <DialogContent className="w-fit max-w-[80vw] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl [&>button]:text-black">
                        <DialogHeader className="p-6 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                <Server className="size-6" />
                                Server Configuration
                            </DialogTitle>
                            <Button
                                variant="default"
                                size="icon"
                                className="mr-8 bg-black hover:bg-black/80 text-white border-none shrink-0"
                                onClick={() => copyToClipboard(formattedServerConfig, 'server')}
                                title={copiedServer ? "Copied!" : "Copy Config"}
                            >
                                {copiedServer ? <Check className="size-4" /> : <Copy className="size-4" />}
                            </Button>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto bg-[#0d1117]">
                            <pre className="font-mono text-sm text-white p-6">
                                {formattedServerConfig}
                            </pre>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
