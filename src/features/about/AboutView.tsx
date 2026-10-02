import { Fragment, type ReactNode } from "react";
import type { AboutContent, RichNode } from "./content";
import styles from "./AboutView.module.css";
function richNode(node: RichNode, key: number): ReactNode {
  const children = node.content?.map(richNode);
  switch (node.type) {
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
export function AboutView({ content }: { content: AboutContent }) {
  return (
    <article className={`prose-page ${styles.page}`}>
      <p className="type-overline">Nib Atlas</p>
      <h1 className="type-h1">{content.title}</h1>
      {content.introduction && (
        <p className={`type-body-lg ${styles.introduction}`}>
          {content.introduction}
        </p>
      )}
      {richNode(content.body, 0)}
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
                  <strong>
                    {p.url ? (
                      <a href={p.url} rel="noopener noreferrer">
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                  </strong>
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
