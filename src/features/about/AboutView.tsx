import { Fragment, type ReactNode } from "react";
import { aboutImageUrl, type AboutContent, type RichNode } from "./content";
import { Icon } from "@/src/components/ui/Icon";
import { PlatformIcon } from "@/src/components/ui/PlatformIcon";
import styles from "./AboutView.module.css";
function richNode(node: RichNode, key: number, preview: boolean): ReactNode {
  const children = node.content?.map((child, i) => richNode(child, i, preview));
  switch (node.type) {
    case "aboutImage":
      return (
        <figure key={key} className={styles.figure}>
          {/* Uploaded images are delivered through the publication-aware endpoint. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={aboutImageUrl(node.attrs!.imageId!, preview)}
            alt={node.attrs!.alt!}
            width={node.attrs!.width}
            height={node.attrs!.height}
            loading="lazy"
          />
          {node.attrs?.caption && <figcaption>{node.attrs.caption}</figcaption>}
        </figure>
      );
    case "doc":
      return <Fragment key={key}>{children}</Fragment>;
    case "text": {
      let result: ReactNode = node.text;
      for (const mark of node.marks ?? [])
        result =
          mark.type === "bold" ? (
            <strong>{result}</strong>
          ) : (
            <a href={mark.attrs.href} rel="noopener noreferrer">
              {result}
            </a>
          );
      return <Fragment key={key}>{result}</Fragment>;
    }
    case "paragraph":
      return <p key={key}>{children ?? <br />}</p>;
    case "heading":
      return node.attrs?.level === 3 ? (
        <h3 key={key} className="type-h3">
          {children}
        </h3>
      ) : (
        <h2 key={key} className="type-h2">
          {children}
        </h2>
      );
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={node.attrs?.start ?? 1}>
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "hardBreak":
      return <br key={key} />;
  }
}
/** Shared public/private-preview renderer. Text is escaped; no HTML injection. */
export function AboutView({
  content,
  preview = false,
}: {
  content: AboutContent;
  preview?: boolean;
}) {
  return (
    <article className={`prose-page ${styles.page}`}>
      <p className="type-overline">Nib Atlas</p>
      <h1 className="type-h1">{content.title}</h1>
      {content.introduction && (
        <p className={`type-body-lg ${styles.introduction}`}>
          {content.introduction}
        </p>
      )}
      <div className={styles.body}>{richNode(content.body, 0, preview)}</div>
      {(["team", "thanks"] as const).map((group) => {
        const people = content.people.filter((p) => p.group === group);
        if (!people.length) return null;
        return (
          <section key={group}>
            <h2 className="type-h2">
              {group === "team" ? content.teamHeading : content.thanksHeading}
            </h2>
            <ul className={styles.people}>
              {people.map((p) => (
                <li key={p.id}>
                  <div className={styles.personHeader}>
                    <h3 className={styles.personName} title={p.name}>
                      {p.name}
                    </h3>
                    <div className={styles.personLinks}>
                      {p.url && (
                        <a
                          href={p.url}
                          aria-label={`${p.name} — Website`}
                          title="Website"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon name="globe" size={20} />
                        </a>
                      )}
                      {p.linkedin && (
                        <a
                          href={p.linkedin}
                          aria-label={`${p.name} — LinkedIn`}
                          title="LinkedIn"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M7 10v7M11 17v-7m0 3a3 3 0 0 1 6 0v4" />
                            <circle cx="7" cy="7" r=".5" fill="currentColor" />
                          </svg>
                        </a>
                      )}
                      {p.instagram && (
                        <a
                          href={p.instagram}
                          aria-label={`${p.name} — Instagram`}
                          title="Instagram"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <PlatformIcon platform="instagram" size={20} />
                        </a>
                      )}
                    </div>
                  </div>
                  <p>{p.description}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {content.support.enabled && (
        <section className={styles.support}>
          <h2 className="type-h2">{content.support.heading}</h2>
          <p>{content.support.description}</p>
          <a
            className={styles.button}
            href={content.support.url}
            rel="noopener noreferrer"
          >
            {content.support.buttonLabel}
          </a>
        </section>
      )}
    </article>
  );
}
