import katex from "katex";
import { useMemo } from "react";
import type { ReactNode } from "react";

export function Tex({ src, display }: { src: string; display?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(src, { displayMode: !!display, throwOnError: false, strict: "ignore", output: "html" });
    } catch {
      return src.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    }
  }, [src, display]);
  return <span className={display ? "tex tex-display" : "tex"} dangerouslySetInnerHTML={{ __html: html }} />;
}

function inline(text: string, key: string): ReactNode[] {
  // **bold** and `code`
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith("**") ? <b key={`${key}b${i++}`}>{tok.slice(2, -2)}</b> : <code key={`${key}c${i++}`}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Minimal markdown + LaTeX ($...$ / $$...$$ / \(...\) / \[...\]) renderer for tutor answers. */
export function RichText({ text }: { text: string }) {
  const nodes = useMemo(() => {
    const out: ReactNode[] = [];
    const re = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    const pushText = (s: string) => {
      const lines = s.split("\n");
      lines.forEach((line, li) => {
        if (li > 0) out.push(<br key={`br${k++}`} />);
        const bullet = line.match(/^\s*[-*•]\s+(.*)/);
        const heading = line.match(/^\s*#{1,4}\s+(.*)/);
        if (bullet) out.push(<span key={`l${k++}`} className="bullet">• {inline(bullet[1], `i${k}`)}</span>);
        else if (heading) out.push(<b key={`h${k++}`}>{inline(heading[1], `i${k}`)}</b>);
        else out.push(...inline(line, `t${k++}`));
      });
    };
    while ((m = re.exec(text))) {
      if (m.index > last) pushText(text.slice(last, m.index));
      const tok = m[0];
      const display = tok.startsWith("$$") || tok.startsWith("\\[");
      const src = tok.startsWith("$$") ? tok.slice(2, -2) : tok.startsWith("$") ? tok.slice(1, -1) : tok.slice(2, -2);
      out.push(<Tex key={`m${k++}`} src={src} display={display} />);
      last = m.index + tok.length;
    }
    if (last < text.length) pushText(text.slice(last));
    return out;
  }, [text]);
  return <div className="rich">{nodes}</div>;
}
