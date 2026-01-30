import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import ConfigSectionClient from "./ConfigSectionClient";

interface ConfigSectionProps {
    gameConfig: string;
    serverConfig: string;
}

async function highlightJson(json: string) {
    const file = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeHighlight)
        .use(rehypeStringify)
        .process(`\`\`\`json\n${json}\n\`\`\``);
    return String(file);
}

export default async function ConfigSection({
    gameConfig,
    serverConfig,
}: ConfigSectionProps) {
    const gameConfigHtml = await highlightJson(gameConfig || "{}");
    const serverConfigHtml = await highlightJson(serverConfig || "{}");

    return (
        <ConfigSectionClient
            gameConfig={gameConfig}
            serverConfig={serverConfig}
            gameConfigHtml={gameConfigHtml}
            serverConfigHtml={serverConfigHtml}
        />
    );
}
