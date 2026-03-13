"use client";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const rendered = renderMarkdown(content);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push(`<h1 class="text-xl md:text-2xl font-bold text-[color:var(--accent-strong)] mt-5 mb-2.5 heading">${escapeHtml(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push(`<h2 class="text-lg md:text-xl font-semibold text-[color:var(--accent-strong)] mt-4 mb-1.5 heading">${escapeHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push(`<h3 class="text-base md:text-lg font-semibold text-[color:var(--amber)] mt-3 mb-1 heading">${escapeHtml(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("- ")) {
      if (!inList) { output.push('<ul class="list-none space-y-1 my-2">'); inList = true; }
      output.push(`<li class="flex gap-2 text-[color:var(--text-soft)]"><span class="text-[color:var(--accent-strong)] mt-0.5">▸</span><span>${formatInline(trimmed.slice(2))}</span></li>`);
    } else if (trimmed === "") {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push("<div class='h-2'></div>");
    } else {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push(`<p class="text-[color:var(--text-soft)] leading-relaxed">${formatInline(trimmed)}</p>`);
    }
  }

  if (inList) output.push("</ul>");
  return output.join("\n");
}

function formatInline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em class="text-[var(--muted)]">$1</em>');
  result = result.replace(/`(.+?)`/g, '<code class="rounded bg-black/20 px-1 text-[color:var(--accent-strong)] mono text-xs">$1</code>');
  return result;
}
