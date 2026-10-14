import { it, expect } from "vitest";
import { aboutFeedback } from "./validation-feedback";
import { AboutValidationError } from "./content";
import { DEFAULT_ABOUT } from "./default-content";
it("names the person and platform without exposing a storage path", () => {
  const draft = {
    ...DEFAULT_ABOUT,
    people: [
      {
        id: "person-id",
        group: "team" as const,
        name: "Gin",
        description: "Founder",
        url: "",
      },
    ],
  };
  const result = aboutFeedback(
    new AboutValidationError("people.0.linkedin", "Invalid link"),
    draft,
  );
  expect(result).toEqual({
    field: "person-person-id-linkedin",
    label: "Gin — LinkedIn link",
    message: expect.stringContaining("https://www.linkedin.com/in/your-name"),
  });
  expect(result.label + result.message).not.toContain("people.0");
});
it("identifies unnamed entries by group and keeps known non-person field labels", () => {
  const draft = {
    ...DEFAULT_ABOUT,
    people: [
      { id: "x", group: "thanks" as const, name: "", description: "", url: "" },
    ],
  };
  expect(
    aboutFeedback(
      new AboutValidationError("people.0.description", "Complete this field"),
      draft,
    ).label,
  ).toBe("With thanks entry 1 — Role or contribution");
  expect(
    aboutFeedback(
      new AboutValidationError("support.buttonLabel", "Required"),
      draft,
    ).label,
  ).toBe("Support button label");
});
