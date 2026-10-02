import type { Metadata } from "next";
import { AboutView } from "@/src/features/about/AboutView";
import { readPublishedAbout } from "@/src/server/about/read";
import { cache } from "react";
export const dynamic = "force-dynamic";
const content = cache(readPublishedAbout);
export async function generateMetadata(): Promise<Metadata> {
  try {
    return {
      title: (await content()).title,
      description:
        "About Nib Atlas and its curated catalogue of fountain pen shops.",
    };
  } catch {
    return { title: "About Nib Atlas" };
  }
}
export default async function AboutPage() {
  let document;
  try {
    document = await content();
  } catch {
    return (
      <article className="prose-page">
        <h1 className="type-h1">About Nib Atlas</h1>
        <p>We couldn’t load this page. Please try again shortly.</p>
        <a href="/about">Try again</a>
      </article>
    );
  }
  return <AboutView content={document} />;
}
