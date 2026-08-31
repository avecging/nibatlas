import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContributeForm } from "@/src/components/contribute/ContributeForm";

const FALLBACK = "mailto:hello@nibatlas.com?subject=%5BSuggest%20shop%5D";

function renderSuggestion() {
  render(
    <ContributeForm
      kind="suggestion"
      fallbackHref={FALLBACK}
      submitLabel="Send this suggestion"
      confirmation="Someone will look into this shop."
    />,
  );
}

function renderCorrection() {
  render(
    <ContributeForm
      kind="correction"
      shopSlug="ty-lee-pen-shop"
      fallbackHref="mailto:hello@nibatlas.com"
      submitLabel="Send this correction"
      confirmation="Someone will check this."
    />,
  );
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Fills the three fields a suggestion cannot do without. */
function fillMinimum() {
  type(/^shop name/i, "Pen and Paper");
  type(/^city/i, "Seoul");
  type(/^country/i, "South Korea");
}

function send(label = /send this suggestion/i) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function accepted() {
  return vi.fn(async () => Response.json({ ok: true }));
}

beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) => {
      callback(0);

      return 0;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the form a person sees", () => {
  it("marks what is optional rather than decorating what is required", () => {
    renderSuggestion();

    // Almost everything here is optional, so asterisking the three required
    // fields would decorate the page and still leave the reader counting.
    expect(screen.getByLabelText(/^shop name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name in the local script — optional/i)).toBeInTheDocument();
    expect(screen.getByText(/^shop name$/i)).toBeInTheDocument();
  });

  it("never asks a correction which listing it is about", () => {
    renderCorrection();

    expect(screen.queryByLabelText(/shop name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/which shop/i)).not.toBeInTheDocument();
  });
});

describe("validation before anything is sent", () => {
  it("does not post an incomplete submission, and says what is missing", async () => {
    const fetchMock = accepted();
    vi.stubGlobal("fetch", fetchMock);

    renderSuggestion();
    send();

    const summary = await screen.findByRole("alert");

    expect(summary).toHaveTextContent(/3 things need a look/i);
    expect(within(summary).getByRole("link", { name: /city is needed/i })).toHaveAttribute(
      "href",
      "#contribute-city",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the field itself, not only the summary", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    send();
    await screen.findByRole("alert");

    const city = screen.getByLabelText(/^city/i);

    expect(city).toHaveAttribute("aria-invalid", "true");
    expect(city).toHaveAccessibleDescription(/city is needed/i);
  });

  it("clears a field's error as soon as that field is touched", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    send();
    await screen.findByRole("alert");

    type(/^city/i, "Seoul");

    expect(screen.getByLabelText(/^city/i)).not.toHaveAttribute("aria-invalid");
  });

  it("asks for a name once an email is given, and not before", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    fillMinimum();
    type(/your email/i, "someone@example.com");
    send();

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent(/someone to address/i);

    type(/your name/i, "Somebody");
    send();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/thank you/i),
    );
  });

  it("sends an anonymous submission without complaint", async () => {
    const fetchMock = accepted();
    vi.stubGlobal("fetch", fetchMock);

    renderSuggestion();
    fillMinimum();
    send();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});

describe("what is posted", () => {
  it("carries the kind and, for a correction, the listing it came from", async () => {
    const fetchMock = accepted();
    vi.stubGlobal("fetch", fetchMock);

    renderCorrection();
    fireEvent.change(screen.getByLabelText(/what kind of thing is wrong/i), {
      target: { value: "hours" },
    });
    type(/what we have wrong/i, "It opens at 11.");
    send(/send this correction/i);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(body.kind).toBe("correction");
    expect(body.shopSlug).toBe("ty-lee-pen-shop");
  });
});

/**
 * The rule this flow exists under: nothing reports a success it did not get.
 */
describe("when the submission cannot be delivered", () => {
  it("says so, keeps what was typed, and offers the email route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: false, error: "unavailable" }, { status: 503 })),
    );

    renderSuggestion();
    fillMinimum();
    type(/what makes it worth a visit/i, "Enormous nib wall.");
    send();

    const failure = await screen.findByRole("alert");

    expect(failure).toHaveTextContent(/did not send/i);
    expect(within(failure).getByRole("link", { name: /by email/i })).toHaveAttribute(
      "href",
      FALLBACK,
    );

    // Nothing typed is lost, and no confirmation is shown.
    expect(screen.getByLabelText(/^shop name/i)).toHaveValue("Pen and Paper");
    expect(screen.getByLabelText(/what makes it worth a visit/i)).toHaveValue(
      "Enormous nib wall.",
    );
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument();
  });

  it("treats a network failure the same way", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    renderSuggestion();
    fillMinimum();
    send();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/did not send/i),
    );
  });

  it("shows the server's own field errors when it disagrees with the browser", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { ok: false, error: "invalid", fieldErrors: { city: "City is needed." } },
          { status: 400 },
        ),
      ),
    );

    renderSuggestion();
    fillMinimum();
    send();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/city is needed/i),
    );
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument();
  });
});

describe("when it works", () => {
  it("replaces the form with a confirmation, and only then", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    fillMinimum();
    send();

    const confirmation = await screen.findByRole("status");

    expect(confirmation).toHaveTextContent(/thank you/i);
    expect(confirmation).toHaveTextContent(/someone will look into this shop/i);
    expect(screen.queryByRole("button", { name: /send this suggestion/i })).not.toBeInTheDocument();
  });
});
