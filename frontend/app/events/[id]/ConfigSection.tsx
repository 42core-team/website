import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import ConfigSectionClient from "./ConfigSectionClient";

interface ConfigSectionProps {
  gameConfig?: string | null;
  serverConfig?: string | null;
}

async function highlightJson(json: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypePrettyCode)
    .use(rehypeStringify)
    .process(`\`\`\`json\n${json}\n\`\`\``);
  return String(file);
}

export default async function ConfigSection({
  gameConfig,
  serverConfig,
}: ConfigSectionProps) {
  if (!gameConfig && !serverConfig)
    return null;

  const gameConfigHtml = gameConfig ? await highlightJson(gameConfig) : "";
  const serverConfigHtml = serverConfig ? await highlightJson(serverConfig) : "";

  return (
    <ConfigSectionClient
      gameConfig={gameConfig || "{}"}
      serverConfig={serverConfig || "{}"}
      gameConfigHtml={gameConfigHtml}
      serverConfigHtml={serverConfigHtml}
    />
  );
}
