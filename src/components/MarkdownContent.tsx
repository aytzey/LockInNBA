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
      output.push(`<h1 class="text-xl font-bold text-[#00ff87] mt-4 mb-2 heading">${escapeHtml(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push(`<h2 class="text-lg font-semibold text-[#00ff87] mt-3 mb-1 heading">${escapeHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push(`<h3 class="text-base font-semibold text-[#ffd700] mt-2 mb-1 heading">${escapeHtml(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("- ")) {
      if (!inList) { output.push('<ul class="list-none space-y-1 my-2">'); inList = true; }
      output.push(`<li class="flex gap-2 text-[#f5f5f3]"><span class="text-[#00c853] mt-0.5">▸</span><span>${formatInline(trimmed.slice(2))}</span></li>`);
    } else if (trimmed === "") {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push("<div class='h-2'></div>");
    } else {
      if (inList) { output.push("</ul>"); inList = false; }
      output.push(`<p class="text-[#f5f5f3] leading-relaxed">${formatInline(trimmed)}</p>`);
    }
  }

  if (inList) output.push("</ul>");
  return output.join("\n");
}

function formatInline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em class="text-[#8b92a5]">$1</em>');
  result = result.replace(/`(.+?)`/g, '<code class="bg-black/30 px-1 rounded text-[#00ff87] mono text-xs">$1</code>');
  return result;
}
