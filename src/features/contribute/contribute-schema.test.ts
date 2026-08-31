import { describe, expect, it } from "vitest";

import {
  CORRECTION_FIELDS,
  SUGGESTION_FIELDS,
  fieldsFor,
  hasErrors,
  normaliseSubmission,
  validateSubmission,
} from "@/src/features/contribute/contribute-schema";

/** The minimum each kind accepts, so a test says what it is varying. */
const SUGGESTION = {
  shop_name: "Pen and Paper",
  city: "Seoul",
  country: "South Korea",
};

const CORRECTION = {
  correction_type: "hours",
  what_is_wrong: "It opens at 11, not 10.",
};

describe("what a contribution asks for", () => {
  it("requires only the parts that make a lead researchable", () => {
    const required = SUGGESTION_FIELDS.filter((field) => field.required).map(
      (field) => field.name,
    );

    // A name and a place can be researched. A description of a shop nobody can
    // find cannot, which is why nothing else is compulsory.
    expect(required).toEqual(["shop_name", "city", "country"]);
  });

  it("never asks a correction which listing it is about", () => {
    const names = CORRECTION_FIELDS.map((field) => field.name);

    expect(names).not.toContain("shop_slug");
    expect(names).not.toContain("shop_name");
  });

  it("offers no category that turns a correction into a review", () => {
    const categories = fieldsFor("correction").find(
      (field) => field.name === "correction_type",
    );

    for (const option of categories?.options ?? []) {
      expect(option.label).not.toMatch(/rude|bad|poor|rating|review|experience/i);
    }
  });

  it("keeps a contact pair on both kinds, and neither is required", () => {
    for (const kind of ["suggestion", "correction"] as const) {
      const contact = fieldsFor(kind).filter((field) =>
        field.name.startsWith("contributor_"),
      );

      expect(contact.map((field) => field.name)).toEqual([
        "contributor_email",
        "contributor_name",
      ]);
      expect(contact.every((field) => !field.required)).toBe(true);
    }
  });
});

describe("validation", () => {
  it("accepts the minimum, anonymously", () => {
    expect(validateSubmission("suggestion", SUGGESTION)).toEqual({});
    expect(validateSubmission("correction", CORRECTION)).toEqual({});
  });

  it("names each missing required field rather than failing as a whole", () => {
    const errors = validateSubmission("suggestion", { shop_name: "Pen and Paper" });

    expect(Object.keys(errors).sort()).toEqual(["city", "country"]);
    expect(errors["city"]).toMatch(/city is needed/i);
  });

  it("treats whitespace as empty", () => {
    const errors = validateSubmission("correction", {
      ...CORRECTION,
      what_is_wrong: "   ",
    });

    expect(errors["what_is_wrong"]).toBeDefined();
  });

  it("rejects a value past its own limit, and says what the limit is", () => {
    const errors = validateSubmission("suggestion", {
      ...SUGGESTION,
      shop_name: "x".repeat(201),
    });

    expect(errors["shop_name"]).toMatch(/201 characters.*limit is 200/i);
  });

  it("rejects a category that is not on the list", () => {
    const errors = validateSubmission("correction", {
      ...CORRECTION,
      correction_type: "made-up",
    });

    expect(errors["correction_type"]).toBeDefined();
  });

  it("catches the email mistakes a person would want caught", () => {
    for (const bad of ["nope", "a@b", "a b@example.com", "a@example.com,"]) {
      const errors = validateSubmission("suggestion", {
        ...SUGGESTION,
        contributor_email: bad,
        contributor_name: "Somebody",
      });

      expect(errors["contributor_email"], bad).toBeDefined();
    }
  });

  it("accepts ordinary addresses rather than enforcing a standard", () => {
    for (const good of [
      "a@example.com",
      "first.last+tag@sub.example.co.uk",
      "someone@example.museum",
    ]) {
      const errors = validateSubmission("suggestion", {
        ...SUGGESTION,
        contributor_email: good,
        contributor_name: "Somebody",
      });

      expect(errors["contributor_email"], good).toBeUndefined();
    }
  });
});

/**
 * The one conditional rule, from the founder: an address with nobody to address
 * it to is not useful, so a name is required exactly when an email is given.
 */
describe("the contact pair", () => {
  it("requires a name once an email is given", () => {
    const errors = validateSubmission("suggestion", {
      ...SUGGESTION,
      contributor_email: "someone@example.com",
    });

    expect(errors["contributor_name"]).toMatch(/someone to address/i);
  });

  it("asks for nothing further when only a name is given", () => {
    expect(
      validateSubmission("suggestion", {
        ...SUGGESTION,
        contributor_name: "Somebody",
      }),
    ).toEqual({});
  });

  it("asks for neither when neither is given", () => {
    expect(hasErrors(validateSubmission("suggestion", SUGGESTION))).toBe(false);
  });
});

describe("what is handed on", () => {
  it("trims, drops empties, and keeps only what the schema declares", () => {
    const normalised = normaliseSubmission("suggestion", {
      ...SUGGESTION,
      shop_name: "  Pen and Paper  ",
      local_name: "",
      // Neither of these is a field on this form.
      status: "applied",
      admin_notes: "approved by me",
    });

    expect(normalised).toEqual({
      shop_name: "Pen and Paper",
      city: "Seoul",
      country: "South Korea",
    });
  });

  it("never lets a submission write the reviewing team's own columns", () => {
    const normalised = normaliseSubmission("correction", {
      ...CORRECTION,
      status: "applied",
      admin_notes: "nothing to see",
    });

    expect(normalised["status"]).toBeUndefined();
    expect(normalised["admin_notes"]).toBeUndefined();
  });

  /*
   * The listing is resolved from the route, server-side, and added after this.
   * A request naming its own shop is a request choosing which listing to file
   * against, so those keys are dropped here rather than carried through.
   */
  it("drops a listing a request tried to name for itself", () => {
    const normalised = normaliseSubmission("correction", {
      ...CORRECTION,
      shop_slug: "somewhere-else",
      shop_name: "Somewhere Else",
    });

    expect(normalised["shop_slug"]).toBeUndefined();
    expect(normalised["shop_name"]).toBeUndefined();
  });
});
