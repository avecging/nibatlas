"use client";

import type { FieldDefinition } from "@/src/features/contribute/contribute-schema";

import styles from "./ContributeForm.module.css";

/**
 * One labelled control.
 *
 * Every field is a real `<label>` bound to its control, so the label is a hit
 * target and a screen reader announces it. A hint and an error are separate
 * elements referenced through `aria-describedby` rather than folded into the
 * label, because the label is the field's name and should not change as the
 * person types.
 *
 * Optional is marked, not required. Almost every field on the suggestion form is
 * optional, so marking the required ones would decorate the page with asterisks
 * and still leave the reader counting. Saying *Optional* on the few that are is
 * quieter and answers the question they actually have.
 */
export function Field({
  definition,
  value,
  error,
  disabled,
  onChange,
}: {
  readonly definition: FieldDefinition;
  readonly value: string;
  readonly error: string | undefined;
  readonly disabled: boolean;
  readonly onChange: (name: string, value: string) => void;
}) {
  const id = `contribute-${definition.name}`;
  const hintId = definition.hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    name: definition.name,
    value,
    disabled,
    maxLength: definition.maxLength,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
    ...(definition.autoComplete === undefined
      ? {}
      : { autoComplete: definition.autoComplete }),
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onChange(definition.name, event.target.value),
  };

  return (
    <div className={styles.field} data-invalid={error ? "true" : undefined}>
      <label className={styles.label} htmlFor={id}>
        {definition.label}
        {definition.required ? null : (
          <span className={styles.optional}> — optional</span>
        )}
      </label>

      {definition.hint ? (
        <p className={styles.hint} id={hintId}>
          {definition.hint}
        </p>
      ) : null}

      {definition.control === "textarea" ? (
        <textarea className={styles.textarea} rows={5} {...shared} />
      ) : definition.control === "select" ? (
        <select className={styles.select} {...shared}>
          <option value="">Choose one</option>
          {(definition.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={styles.input}
          type={definition.control === "email" ? "email" : "text"}
          {...shared}
        />
      )}

      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
