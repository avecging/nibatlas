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
 * Required is marked with an asterisk, and the form says once what the asterisk
 * means. The control also carries `required`, so assistive technology announces
 * it rather than depending on a character a screen reader may skip.
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
    required: definition.required,
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
        {definition.required ? (
          <span aria-hidden="true" className={styles.required}>
            *
          </span>
        ) : null}
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
          {/*
            The prompt is the starting state, not a choice. `disabled` keeps it
            unselectable once the reader has moved off it, so "Choose one" can
            never be submitted as an answer — and `required` on the control makes
            the empty value fail validation rather than pass silently.
          */}
          <option value="" disabled>
            Choose one
          </option>
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
