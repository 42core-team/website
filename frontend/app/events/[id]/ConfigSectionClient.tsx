"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Server, Copy, Check, X, ChartLine } from "lucide-react";
import { useState } from "react";
import GameConfigVisualization from "./GameConfigVisualization";

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
            <DialogContent className="w-fit max-w-[90vw] max-h-[90vh] bg-[#0d1117] p-0 border border-white/10 shadow-2xl flex flex-col gap-0 [&>button.absolute]:hidden overflow-hidden">
                <div className="z-50 bg-[#0d1117] flex items-center justify-between p-6 pb-4 border-b border-white/5 shrink-0">
                    <DialogHeader className="p-0 border-0 flex-1">
                        <DialogTitle className="text-xl font-bold flex items-center gap-3 text-white">
                            {icon}
                            {title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                            onClick={copyToClipboard}
                            title={copied ? "Copied!" : `Copy ${label}`}
                        >
                            {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                        </Button>
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                            >
                                <X className="size-4" />
                                <span className="sr-only">Close</span>
                            </Button>
                        </DialogClose>
                    </div>
                </div>
                <div
                    className="overflow-auto flex-1 px-6 pb-6 pt-4 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: configHtml }}
                />
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
        <div className="w-full">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Configuration
                </h3>
            </div>
            
            <Tabs defaultValue="visualizer" className="mt-2 w-full">
                <TabsList className="bg-white/5 border border-white/10">
                    <TabsTrigger value="visualizer" className="gap-2">
                        <ChartLine className="size-4" />
                        Visualizer
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="gap-2">
                        <Code2 className="size-4" />
                        Raw Config
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="visualizer" className="w-full">
                    <GameConfigVisualization gameConfigRaw={gameConfig} />
                </TabsContent>
                
                <TabsContent value="raw">
                    <div className="mt-2 flex flex-col gap-2">
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
                </TabsContent>
            </Tabs>
        </div>
    );
}
