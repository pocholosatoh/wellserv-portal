import "server-only";
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { readFile } from "fs/promises";
import path from "path";
import ReactMarkdown, { type Components } from "react-markdown";
import { MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | WellServ",
  description: "Learn how WellServ collects, uses, and protects your personal and health information.",
};

type TocItem = {
  id: string;
  text: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getNodeText).join(" ");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return "";
}

function buildToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of markdown.split("\n")) {
    const match = /^##\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const text = match[1].replace(/\s+#+$/, "").trim();
    const id = slugify(text);
    if (id) items.push({ id, text });
  }
  return items;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const text = getNodeText(children);
    const id = slugify(text);
    return (
      <h2
        id={id}
        className="scroll-mt-24 text-2xl font-semibold text-gray-900 sm:text-3xl"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-gray-900 sm:text-2xl">{children}</h3>
  ),
  p: ({ children }) => <p className="text-base leading-7 text-gray-700">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-2 pl-6 text-base text-gray-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-2 pl-6 text-base text-gray-700">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  a: ({ href, children }) => (
    <a className="text-accent hover:underline" href={href}>
      {children}
    </a>
  ),
  hr: () => <hr className="border-gray-200" />,
};

export default async function PrivacyPage() {
  const filePath = path.join(process.cwd(), "content", "privacy.md");
  const markdown = await readFile(filePath, "utf8");
  const toc = buildToc(markdown);
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[rgb(248,250,251)]"
      style={
        {
          ["--accent" as any]: accent,
          ["--accent-10" as any]: `${accent}1A`,
          ["--accent-33" as any]: `${accent}33`,
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.18),_rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute -right-[20%] top-40 z-0 h-[420px] w-[60%] rounded-full bg-[radial-gradient(circle,_rgba(68,150,155,0.14),_rgba(255,255,255,0))] blur-3xl" />

      <div className="sticky top-0 z-30 border-b border-white/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-white/80 px-3 py-1.5 text-sm text-accent shadow-sm transition hover:bg-accent/10"
          >
            Back to Home
          </Link>
          <a
            href="https://m.me/100882935339577"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" />
            Message us
          </a>
        </div>
      </div>

      <div className="relative z-10">
        <section className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-10 md:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr),280px] lg:gap-8">
            <article className="order-2 space-y-6 rounded-[36px] border border-white/70 bg-white/90 px-6 py-8 shadow-xl backdrop-blur md:px-10 md:py-12 lg:order-1">
              <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
            </article>

            {toc.length > 0 && (
              <aside className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    On this page
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-gray-700">
                    {toc.map((item) => (
                      <li key={item.id}>
                        <a className="transition hover:text-accent" href={`#${item.id}`}>
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            )}
          </div>
        </section>

        <footer className="section text-sm text-gray-600">
          <div className="border-t pt-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p>
                (c) {new Date().getFullYear()} WELLSERV Medical Corporation - DOH Licensed
                Facilities
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a className="hover:underline" href="/patient/">
                  Results Portal
                </a>
                <a className="hover:underline" href="/pricelist">
                  Price List
                </a>
                <a className="hover:underline" href="/privacy">
                  Privacy Policy
                </a>
                <a
                  className="hover:underline"
                  href="https://facebook.com/wellservmedicalcorporation"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
