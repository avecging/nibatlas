/**
 * What a contribution collects, and what makes one valid.
 *
 * One module, used by three callers: the form renders from it, the browser
 * validates against it before posting, and `POST /api/contribute` validates
 * against it again before anything leaves the Worker. The third is the one that
 * counts — client validation is a courtesy to the person typing, not a control —
 * and sharing the definition is what stops the two from drifting apart.
 *
 * The field keys are the spreadsheet's column names. They are a contract with
 * `scripts/apps-script/contribute.gs`, which appends in the order the sheet
 * declares; renaming one here without renaming it there silently writes to the
 * wrong column.
 */

export type ContributionKind = "suggestion" | "correction";

export type FieldControl = "text" | "email" | "textarea" | "select";

export interface FieldDefinition {
  readonly name: string;
  readonly label: string;
  /** Shown under the label. Says what to put in, never how the form works. */
  readonly hint?: string;
  readonly control: FieldControl;
  readonly required: boolean;
  readonly maxLength: number;
  /** `select` only. The first entry is the empty prompt. */
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  /** Browser autofill token, where one genuinely applies. */
  readonly autoComplete?: string;
}

/**
 * The contact pair.
 *
 * Both optional, and shared by both kinds. An email with no name gives the
 * research team an address and nobody to write to, so a name is required once an
 * email is given — the only conditional rule in the schema. A name on its own
 * asks for nothing further.
 *
 * When accounts arrive these two are filled from the profile rather than typed.
 */
const CONTACT_FIELDS: readonly FieldDefinition[] = [
  {
    name: "contributor_email",
    label: "Your email",
    hint: "Only if you are happy to be asked a follow-up question.",
    control: "email",
    required: false,
    maxLength: 254,
    autoComplete: "email",
  },
  {
    name: "contributor_name",
    label: "Your name",
    control: "text",
    required: false,
    maxLength: 120,
    autoComplete: "name",
  },
];

export const SUGGESTION_FIELDS: readonly FieldDefinition[] = [
  {
    name: "shop_name",
    label: "Shop name",
    control: "text",
    required: true,
    maxLength: 200,
  },
  {
    name: "local_name",
    label: "Name in the local script",
    hint: "If it has one, and you know it.",
    control: "text",
    required: false,
    maxLength: 200,
  },
  {
    name: "city",
    label: "City",
    control: "text",
    required: true,
    maxLength: 120,
  },
  {
    name: "country",
    label: "Country",
    control: "text",
    required: true,
    maxLength: 120,
  },
  {
    name: "address_or_map_link",
    label: "Address or map link",
    hint: "Whichever you have. A pasted map link is enough.",
    control: "text",
    required: false,
    maxLength: 500,
  },
  {
    name: "website_or_social",
    label: "Website or social account",
    control: "text",
    required: false,
    maxLength: 500,
  },
  {
    name: "why_worth_visiting",
    label: "What makes it worth a visit",
    hint: "What a fountain pen person would find there — nibs to try, inks, repairs, the people.",
    control: "textarea",
    required: false,
    maxLength: 2000,
  },
  ...CONTACT_FIELDS,
];

/**
 * Correction categories.
 *
 * Deliberately short and about the listing, not about the shop's quality. There
 * is no *bad experience* option: this route corrects the record, and a review
 * surface is not being built here.
 */
export const CORRECTION_TYPES = [
  { value: "closed", label: "It has closed" },
  { value: "moved", label: "It has moved" },
  { value: "hours", label: "The opening hours are wrong" },
  { value: "address", label: "The address or location is wrong" },
  { value: "details", label: "Something about what it offers is wrong" },
  { value: "other", label: "Something else" },
] as const;

export const CORRECTION_FIELDS: readonly FieldDefinition[] = [
  {
    name: "correction_type",
    label: "What kind of thing is wrong",
    control: "select",
    required: true,
    maxLength: 60,
    options: CORRECTION_TYPES,
  },
  {
    name: "what_is_wrong",
    label: "What we have wrong, and what it should say",
    control: "textarea",
    required: true,
    maxLength: 2000,
  },
  {
    name: "source_or_link",
    label: "Where you saw this",
    hint: "A link, or a note that you were there. Optional, but it is what lets us act quickly.",
    control: "text",
    required: false,
    maxLength: 500,
  },
  ...CONTACT_FIELDS,
];

export function fieldsFor(kind: ContributionKind): readonly FieldDefinition[] {
  return kind === "suggestion" ? SUGGESTION_FIELDS : CORRECTION_FIELDS;
}

/**
 * Columns a correction carries that nobody types.
 *
 * The reader never identifies the listing: they arrived from it, so the page
 * knows which one it is. Asking would be asking them to re-type the one fact the
 * product already holds, and would let a correction arrive attached to the wrong
 * shop.
 *
 * **These are supplied by the server, from the slug in the route.** They are
 * named here so the sheet's columns are declared in one place, and
 * {@link normaliseSubmission} deliberately drops them if they arrive in a
 * request: a value a client chose for them is a value a client chose.
 */
export const CORRECTION_CONTEXT_FIELDS = ["shop_slug", "shop_name"] as const;

export type FieldErrors = Readonly<Record<string, string>>;

export type SubmissionValues = Readonly<Record<string, string>>;

/**
 * A permissive email shape check.
 *
 * Deliberately not an attempt at RFC 5322. The only failures worth catching here
 * are the ones a person would want caught — a missing `@`, a bare hostname, a
 * stray space, the comma or full stop a paste drags in — and a stricter pattern
 * rejects real addresses, which is a worse outcome than accepting an unusable
 * one the research team simply cannot reach. Requiring the last label to be
 * letters is what catches the trailing punctuation without narrowing anything
 * real: `.museum` and `.co.uk` both pass.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export function validateSubmission(
  kind: ContributionKind,
  values: SubmissionValues,
): FieldErrors {
  const errors: Record<string, string> = {};
  const read = (name: string) => (values[name] ?? "").trim();

  for (const field of fieldsFor(kind)) {
    const value = read(field.name);

    if (field.required && value === "") {
      errors[field.name] = `${field.label} is needed.`;
      continue;
    }

    if (value.length > field.maxLength) {
      errors[field.name] =
        `${field.label} is too long — ${value.length} characters, and the limit is ${field.maxLength}.`;
      continue;
    }

    if (field.control === "select" && value !== "") {
      const allowed = (field.options ?? []).some((option) => option.value === value);

      if (!allowed) {
        errors[field.name] = `Choose one of the options for ${field.label.toLowerCase()}.`;
      }
    }
  }

  const email = read("contributor_email");

  if (email !== "" && !EMAIL_SHAPE.test(email)) {
    errors["contributor_email"] ??= "That does not look like an email address.";
  }

  /*
   * The one conditional rule. An address with no name reaches someone the
   * research team cannot address, so the name is required exactly when an email
   * is given — and never otherwise.
   */
  if (email !== "" && read("contributor_name") === "") {
    errors["contributor_name"] ??=
      "Please add a name, so a reply has someone to address.";
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Trimmed values, empty fields dropped, nothing the schema does not declare.
 *
 * Only the fields a person fills in. The reviewing team's own columns and the
 * correction's listing are both absent by construction, so neither can be
 * written by a request that names them.
 */
export function normaliseSubmission(
  kind: ContributionKind,
  values: SubmissionValues,
): SubmissionValues {
  const normalised: Record<string, string> = {};

  for (const name of fieldsFor(kind).map((field) => field.name)) {
    const value = (values[name] ?? "").trim();

    if (value !== "") {
      normalised[name] = value;
    }
  }

  return normalised;
}
