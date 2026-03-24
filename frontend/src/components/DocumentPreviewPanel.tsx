import React, { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { convertFileSrc } from "@tauri-apps/api/core";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { extractPageAnchorText } from "../lib/citation-nav";

interface Props {
  title: string;
  content: string;
  sourcePath?: string;
  jumpPage?: number | null;
  pageTexts?: Record<number, string>;
  jumpSignal?: number;
  loading: boolean;
  error: string | null;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(0, index);
}

function resolveMarkdownImageSrc(src: string, sourcePath?: string): string {
  if (!src) return src;
  if (/^(https?:|data:|asset:|tauri:|blob:)/i.test(src)) {
    return src;
  }

  const normalizedSourcePath = sourcePath?.trim();
  if (!normalizedSourcePath) {
    return src;
  }

  const documentDir = dirname(normalizedSourcePath);
  const relative = src.replace(/^\.?\//, "");
  const absolutePath = `${documentDir}/parsed/${relative}`.replace(/\\/g, "/");
  return convertFileSrc(absolutePath);
}

export function DocumentPreviewPanel(props: Props) {
  const contentRef = useRef<HTMLElement | null>(null);
  const normalizedMarkdown = props.content
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const pageAnchor = useMemo(() => {
    if (!props.jumpPage || !props.pageTexts) return "";
    const text = props.pageTexts[props.jumpPage] ?? "";
    if (!text) return "";
    return extractPageAnchorText(text, 36);
  }, [props.jumpPage, props.pageTexts]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || !props.jumpPage) {
      return;
    }

    container.querySelectorAll(".citation-highlight").forEach((node) => {
      node.classList.remove("citation-highlight");
    });

    const candidates = Array.from(container.querySelectorAll("h1, h2, h3, h4, p, li, td, blockquote")) as HTMLElement[];
    let target: HTMLElement | null = null;

    if (pageAnchor) {
      target =
        candidates.find((element) => element.textContent?.includes(pageAnchor)) ??
        null;
    }

    if (!target && candidates.length > 0) {
      target = candidates[0];
    }

    if (!target) return;
    target.classList.add("citation-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [props.jumpPage, props.jumpSignal, pageAnchor, normalizedMarkdown]);

  if (props.loading) {
    return <div className="h-full rounded-3xl bg-white/70 p-6 text-sm font-bold text-slate-500">正在加载文档预览...</div>;
  }

  if (props.error) {
    return (
      <div className="h-full rounded-3xl bg-rose-50 p-6 text-sm font-bold text-rose-600">
        无法加载文档预览：{props.error}
      </div>
    );
  }

  if (!normalizedMarkdown) {
    return <div className="h-full rounded-3xl bg-white/70 p-6 text-sm font-bold text-slate-500">该文档暂无可预览内容。</div>;
  }

  return (
    <div className="soft-scrollbar h-full overflow-y-auto rounded-3xl bg-white/80 p-6">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Document Preview</div>
        <div className="mt-2 truncate text-sm font-black text-slate-900">{props.title}</div>
      </div>
      <article ref={contentRef} className="doc-markdown text-sm leading-7 text-slate-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            img: ({ src = "", alt = "" }) => (
              <img src={resolveMarkdownImageSrc(src, props.sourcePath)} alt={alt} loading="lazy" />
            ),
          }}
        >
          {normalizedMarkdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
