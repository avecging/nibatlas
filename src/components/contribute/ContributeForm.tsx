"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { Field } from "@/src/components/contribute/Field";
import { Turnstile } from "@/src/components/contribute/Turnstile";
import { Button } from "@/src/components/ui/Button";
import {
  fieldsFor,
  hasErrors,
  validateSubmission,
  type ContributionKind,
  type FieldErrors,
} from "@/src/features/contribute/contribute-schema";

import styles from "./ContributeForm.module.css";

type Status = "idle" | "submitting" | "sent" | "failed";

/**
 * The one form both contribution flows use.
 *
 * Two flows, one behaviour: the same validation, the same failure handling, the
 * same confirmation. What differs is the field list, which comes from the
 * schema, and the context a correction carries — which the reader never types.
 *
 * **Nothing here reports a success it did not get.** The confirmation replaces
 * the form only after the route has answered `ok`. Every failure keeps what was
 * typed exactly where it was typed and offers the email address, which has no
 * dependency that can be unavailable.
 */
export function ContributeForm({
  kind,
  shopSlug,
  fallbackHref,
  submitLabel,
  confirmationTitle,
  confirmation,
  anotherLabel,
}: {
  readonly kind: ContributionKind;
  readonly shopSlug?: string;
  /** Where to send someone when the submission cannot be delivered. */
  readonly fallbackHref: string;
  readonly submitLabel: string;
  /** The warm line at the head of the confirmation. */
  readonly confirmationTitle: string;
  readonly confirmation: string;
  /** The control the confirmation offers, for sending a second one. */
  readonly anotherLabel: string;
}) {
  const fields = useMemo(() => fieldsFor(kind), [kind]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const confirmationRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef("");

  /*
   * Dot access, not `process.env["..."]`.
   *
   * Next inlines a `NEXT_PUBLIC_` value at build time by matching the literal
   * member expression, and the bracket form is not matched — it compiles, ships,
   * and is `undefined` in the browser, so no widget renders and every production
   * submission is refused. Nothing fails loudly; it was found by loading the
   * page. The rest of the codebase reads its public keys the same way.
   */
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const update = useCallback((name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));

    /*
     * An error clears as soon as the field it belongs to is touched. Leaving it
     * until the next submit means telling someone their answer is wrong while
     * they are in the middle of fixing it.
     */
    setErrors((current) => {
      if (!(name in current)) {
        return current;
      }

      const next = { ...current };
      delete next[name];

      return next;
    });
  }, []);

  const onToken = useCallback((token: string) => {
    tokenRef.current = token;
  }, []);

  /*
   * Somebody who knows one missing shop often knows two. The confirmation offers
   * a blank form rather than making them find their way back to the page, and
   * clears the previous answers so the second suggestion is not the first one
   * edited.
   */
  const sendAnother = useCallback(() => {
    setValues({});
    setErrors({});
    setStatus("idle");
    tokenRef.current = "";
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (status === "submitting") {
      return;
    }

    const found = validateSubmission(kind, values);

    if (hasErrors(found)) {
      setErrors(found);
      setStatus("idle");
      // The summary is what a keyboard or screen-reader user lands on, and each
      // entry links to the field it is about.
      window.requestAnimationFrame(() => summaryRef.current?.focus());

      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const response = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          values,
          turnstileToken: tokenRef.current,
          ...(shopSlug === undefined ? {} : { shopSlug }),
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        fieldErrors?: FieldErrors;
      };

      if (response.ok && result.ok === true) {
        setStatus("sent");
        window.requestAnimationFrame(() => confirmationRef.current?.focus());

        return;
      }

      /*
       * The server validates again, and it is the authority. If it disagrees
       * with the browser, its answer is the one shown.
       */
      if (result.fieldErrors && hasErrors(result.fieldErrors)) {
        setErrors(result.fieldErrors);
        setStatus("idle");
        window.requestAnimationFrame(() => summaryRef.current?.focus());

        return;
      }

      setStatus("failed");
    } catch {
      setStatus("failed");
    }

    window.requestAnimationFrame(() => summaryRef.current?.focus());
  }

  if (status === "sent") {
    return (
      <div
        className={styles.confirmation}
        ref={confirmationRef}
        role="status"
        tabIndex={-1}
      >
        <h2 className={styles.confirmationTitle}>{confirmationTitle}</h2>
        <p>{confirmation}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={sendAnother}>
            {anotherLabel}
          </Button>
        </div>
      </div>
    );
  }

  const invalid = fields.filter((field) => errors[field.name]);
  const submitting = status === "submitting";

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      {invalid.length > 0 ? (
        <div
          className={styles.summary}
          data-testid="contribute-problem"
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          <p className={styles.summaryTitle}>
            {invalid.length === 1
              ? "One thing needs a look before this can be sent."
              : `${invalid.length} things need a look before this can be sent.`}
          </p>
          <ul className={styles.summaryList}>
            {invalid.map((field) => (
              <li key={field.name}>
                <a href={`#contribute-${field.name}`}>{errors[field.name]}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status === "failed" ? (
        <div
          className={styles.summary}
          data-testid="contribute-problem"
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          <p className={styles.summaryTitle}>That did not send.</p>
          <p>
            Nothing has been lost — everything you wrote is still here, and trying
            again may work. If it keeps failing,{" "}
            <a href={fallbackHref}>send it to us by email</a> instead.
          </p>
        </div>
      ) : null}

      <p className={styles.legend}>
        Fields marked{" "}
        <span className={styles.required}>*</span> are required.
      </p>

      {fields.map((field) => (
        <Field
          key={field.name}
          definition={field}
          value={values[field.name] ?? ""}
          error={errors[field.name]}
          disabled={submitting}
          onChange={update}
        />
      ))}

      <Turnstile siteKey={siteKey} onToken={onToken} />

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Sending…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
