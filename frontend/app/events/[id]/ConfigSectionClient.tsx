"use client";

import { ChartLine, Check, Code2, Copy, Server, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameConfigVisualization from "./GameConfigVisualization";

interface ConfigDialogProps {
  title: string;
  icon: React.ReactNode;
  configHtml: string;
  rawConfig: string;
  label: string;
  showVisualizer?: boolean;
}

function ConfigDialog({ title, icon, configHtml, rawConfig, label, showVisualizer }: ConfigDialogProps) {
  const [copied, setCopied] = useState(false);

  const formatJson = (jsonString: string) => {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2);
    }
    catch {
      return jsonString;
    }
  };

  const copyToClipboard = async () => {
    const formatted = formatJson(rawConfig);
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="group flex w-fit cursor-pointer items-center gap-2">
          <div className="text-muted-foreground transition-colors group-hover:text-primary">
            {icon}
          </div>
          <span className="text-sm text-primary underline decoration-dashed underline-offset-4">
            {label}
          </span>
        </div>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-fit max-w-[90vw] flex-col gap-0 overflow-hidden border border-white/10 bg-[#0d1117] p-0 shadow-2xl [&>button.absolute]:hidden">
        <div className="z-50 flex shrink-0 items-center justify-between border-b border-white/5 bg-[#0d1117] p-6 pb-4">
          <DialogHeader className="flex-1 border-0 p-0">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold text-white">
              {icon}
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={copyToClipboard}
              title={copied ? "Copied!" : `Copy ${label}`}
            >
              {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
            </Button>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          {showVisualizer
            ? (
                <Tabs defaultValue="visualizer" className="flex flex-1 flex-col overflow-hidden">
                  <div className="border-b border-white/5 px-6 py-2">
                    <TabsList className="border border-white/10 bg-white/5">
                      <TabsTrigger value="visualizer" className="gap-2 text-white">
                        <ChartLine className="size-4" />
                        Visualizer
                      </TabsTrigger>
                      <TabsTrigger value="raw" className="gap-2 text-white">
                        <Code2 className="size-4" />
                        Raw Config
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="visualizer" className="flex-1 overflow-auto px-6 pb-6">
                    <GameConfigVisualization gameConfigRaw={rawConfig} />
                  </TabsContent>
                  <TabsContent value="raw" className="flex-1 overflow-auto px-6 pt-1 pb-6">
                    <div
                      className="prose max-w-none dark:prose-invert [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0"
                      dangerouslySetInnerHTML={{ __html: configHtml }}
                    />
                  </TabsContent>
                </Tabs>
              )
            : (
                <div
                  className="prose max-w-none flex-1 overflow-auto px-6 pt-4 pb-6 dark:prose-invert [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0"
                  dangerouslySetInnerHTML={{ __html: configHtml }}
                />
              )}
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
    <div className="w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Configuration
        </h3>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <ConfigDialog
          title="Game Configuration"
          label="Game Config"
          icon={<Code2 className="size-4" />}
          configHtml={gameConfigHtml}
          rawConfig={gameConfig}
          showVisualizer={true}
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
