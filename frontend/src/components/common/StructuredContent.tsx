import { Fragment } from "react";

interface StructuredContentProps {
  content: string;
  className?: string;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

export function StructuredContent({
  content,
  className = "",
}: StructuredContentProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div
              key={`${block.text}-${index}`}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <p
                className={`font-semibold tracking-tight text-[var(--text)] ${
                  block.level <= 2 ? "text-lg" : "text-base"
                }`}
              >
                {renderInline(block.text)}
              </p>
            </div>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={`${block.items.join("-")}-${index}`}
              className="space-y-3 text-sm leading-7 text-[var(--text-secondary)]"
            >
              {block.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-2xl px-3 py-2"
                  style={{ background: "rgba(255, 255, 255, 0.8)" }}
                >
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`${block.text}-${index}`}
            className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]"
          >
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function parseBlocks(content: string): Block[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/\r/g, ""));

  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const listMatch = line.match(/^([-*•]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      list.push(listMatch[2].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderInline(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    const boldMatch = segment.match(/^\*\*([^*]+)\*\*$/);

    if (boldMatch) {
      return (
        <strong key={`${boldMatch[1]}-${index}`} className="font-semibold text-[var(--text)]">
          {boldMatch[1]}
        </strong>
      );
    }

    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}
