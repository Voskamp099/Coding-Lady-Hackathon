'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown renderer styled for the Morandi / TimeMirror chat bubble.
 *
 * The backend Chat Agent prompt asks the LLM to output a 6-section markdown
 * answer (## headings, bullet lists, bold, code blocks). Without this component
 * the raw "#"/"**" symbols show up as literal text.
 *
 * Usage:
 *   <Markdown>{content}</Markdown>
 *
 * All elements inherit the parent bubble's text-sm / text-[#6B5B45] and just
 * add structural styling (heading sizes, list indentation, code background).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-base font-bold mt-3 mb-1 first:mt-0 text-[#6B5B45]" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-sm font-bold mt-3 mb-1 first:mt-0 text-[#6B5B45]" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0 text-[#6B5B45]" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0 text-[#6B5B45]" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed pl-0.5" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-[#6B5B45]" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            // Block code (``` ```) vs inline code
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <code
                  className="block bg-[#6B5B45]/8 rounded-lg px-3 py-2 text-xs font-mono mb-2 last:mb-0 overflow-x-auto text-[#6B5B45]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="bg-[#6B5B45]/10 rounded px-1 py-0.5 text-xs font-mono text-[#6B5B45]"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, ...props }) => (
            <pre className="mb-2 last:mb-0" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-2 border-[#C4A35A]/40 pl-3 my-2 text-[#8B7B65] italic"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-[#6B5B45]/10" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-[#C4A35A] underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-2 last:mb-0">
              <table className="w-full text-xs border-collapse" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-[#6B5B45]/20 px-2 py-1 font-bold text-left text-[#6B5B45]" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-[#6B5B45]/20 px-2 py-1 text-[#6B5B45]" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
