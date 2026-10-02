import { AboutValidationError, type AboutContent } from "./content";
/** Translate validation paths into editor labels; never display storage paths to authors. */
export function aboutFeedback(
  error: AboutValidationError,
  draft: AboutContent,
) {
  let field = error.field,
    label = "About content",
    message = error.message;
  const labels: Record<string, string> = {
    title: "Page title",
    introduction: "Introduction",
    body: "Main body",
    teamHeading: "Team heading",
    thanksHeading: "Thanks heading",
    "support.heading": "Support heading",
    "support.description": "Support description",
    "support.buttonLabel": "Support button label",
    "support.url": "Support destination",
  };
  const person =
    /^people\.(\d+)(?:\.(name|description|url|linkedin|instagram))?$/.exec(
      field,
    );
  if (person) {
    const p = draft.people[Number(person[1])],
      key = person[2] ?? "name";
    if (p) {
      const group = p.group === "team" ? "Our team" : "With thanks";
      const name =
        p.name.trim() ||
        `${group} entry ${draft.people.filter((v) => v.group === p.group).findIndex((v) => v.id === p.id) + 1}`;
      const names: Record<string, string> = {
        name: "Name",
        description: "Role or contribution",
        url: "Website",
        linkedin: "LinkedIn link",
        instagram: "Instagram link",
      };
      label = `${name} — ${names[key]}`;
      field = `person-${p.id}-${key}`;
      if (key === "linkedin")
        message =
          "Enter a full LinkedIn URL, such as https://www.linkedin.com/in/your-name, or leave this field blank.";
      if (key === "instagram")
        message =
          "Enter a full Instagram URL, such as https://www.instagram.com/your-name, or leave this field blank.";
      if (key === "url")
        message =
          "Enter a full website URL starting with https:// or http://, or leave this field blank.";
    } else field = "body";
  } else if (labels[field]) label = labels[field]!;
  else {
    field = "body";
    label = "Main body";
  }
  if (error.field === "support.url")
    message =
      "Enter the full external support URL starting with https:// or http://.";
  return { field, label, message };
}
