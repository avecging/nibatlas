import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContributeForm } from "@/src/components/contribute/ContributeForm";

const FALLBACK = "mailto:hello@nibatlas.com?subject=%5BSuggest%20shop%5D";

function renderSuggestion() {
  render(
    <ContributeForm
      kind="suggestion"
      fallbackHref={FALLBACK}
      submitLabel="Send this suggestion"
      confirmationTitle="Thanks for contributing!"
      confirmation="We’ll look this one up."
      anotherLabel="Suggest another shop"
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
      confirmationTitle="Thanks for reporting!"
      confirmation="We’ll take a look."
      anotherLabel="Report something else"
    />,
  );
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Fills the two fields a suggestion cannot do without. */
function fillMinimum() {
  type(/^shop name/i, "Pen and Paper");
  type(/^country/i, "South Korea");
}

function send(label = /send this suggestion/i) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function accepted() {
  return vi.fn(async () => Response.json({ ok: true }));
}

/** A controllable stand-in for the explicitly rendered Cloudflare widget. */
function installTurnstile() {
  let deliverToken: ((token: string) => void) | undefined;
  const reset = vi.fn();
  const renderWidget = vi.fn(
    (
      _element: HTMLElement,
      options: { readonly callback: (token: string) => void },
    ) => {
      deliverToken = options.callback;

      return "turnstile-widget";
    },
  );

  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
  vi.stubGlobal("turnstile", {
    render: renderWidget,
    remove: vi.fn(),
    reset,
  });

  return {
    renderWidget,
    reset,
    issue(token: string) {
      if (!deliverToken) {
        throw new Error("Turnstile was not rendered");
      }

      act(() => deliverToken?.(token));
    },
  };
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the form a person sees", () => {
  it("marks the required fields, and says once what the mark means", () => {
    renderSuggestion();

    // The legend spans an element, so it is matched on the whole line rather
    // than on a text node — which is also what asserts the spacing around the
    // marker survived JSX.
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Fields marked * are required.",
      ),
    ).toBeInTheDocument();

    // The asterisk is decoration; `required` is what a screen reader announces.
    expect(screen.getByLabelText(/^shop name/i)).toBeRequired();
    expect(screen.getByLabelText(/^country/i)).toBeRequired();
    expect(screen.getByLabelText(/^city/i)).not.toBeRequired();
    expect(screen.getByLabelText(/^local name/i)).not.toBeRequired();
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

    expect(summary).toHaveTextContent(/2 things need a look/i);
    expect(
      within(summary).getByRole("link", { name: /country is needed/i }),
    ).toHaveAttribute("href", "#contribute-country");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the field itself, not only the summary", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    send();
    await screen.findByRole("alert");

    const country = screen.getByLabelText(/^country/i);

    expect(country).toHaveAttribute("aria-invalid", "true");
    expect(country).toHaveAccessibleDescription(/country is needed/i);
  });

  it("clears a field's error as soon as that field is touched", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    send();
    await screen.findByRole("alert");

    type(/^country/i, "South Korea");

    expect(screen.getByLabelText(/^country/i)).not.toHaveAttribute("aria-invalid");
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
      expect(screen.getByRole("status")).toHaveTextContent(/thanks for contributing/i),
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
    fireEvent.change(screen.getByLabelText(/what needs to be fixed/i), {
      target: { value: "hours" },
    });
    type(/tell us more/i, "It opens at 11.");
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
    expect(screen.queryByText(/thanks for/i)).not.toBeInTheDocument();
  });

  it("blocks an automatic retry when network delivery is uncertain", async () => {
    const challenge = installTurnstile();
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });

    vi.stubGlobal("fetch", fetchMock);

    renderSuggestion();
    await waitFor(() => expect(challenge.renderWidget).toHaveBeenCalled());
    challenge.issue("possibly-consumed-token");
    fillMinimum();
    send();

    const failure = await screen.findByRole("alert");

    expect(failure).toHaveTextContent(/could not confirm whether that sent/i);
    expect(failure).toHaveTextContent(/avoid sending the same contribution twice/i);
    expect(challenge.reset).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^shop name/i)).toHaveValue("Pen and Paper");

    const submit = screen.getByRole("button", { name: /delivery unconfirmed/i });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a failed delivery with a fresh challenge token", async () => {
    const challenge = installTurnstile();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ ok: false, error: "not_delivered" }, { status: 502 }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);

    renderSuggestion();
    await waitFor(() => expect(challenge.renderWidget).toHaveBeenCalled());
    challenge.issue("consumed-token");
    fillMinimum();
    send();

    await screen.findByRole("alert");
    expect(challenge.reset).toHaveBeenCalledWith("turnstile-widget");

    challenge.issue("fresh-token");
    send();

    await screen.findByRole("status");

    const [, firstInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, secondInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const firstBody = JSON.parse(String(firstInit.body));
    const secondBody = JSON.parse(String(secondInit.body));

    expect(firstBody.turnstileToken).toBe("consumed-token");
    expect(secondBody.turnstileToken).toBe("fresh-token");
  });

  it("shows the server's own field errors when it disagrees with the browser", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { ok: false, error: "invalid", fieldErrors: { country: "Country is needed." } },
          { status: 400 },
        ),
      ),
    );

    renderSuggestion();
    fillMinimum();
    send();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/country is needed/i),
    );
    expect(screen.queryByText(/thanks for/i)).not.toBeInTheDocument();
  });
});

describe("when it works", () => {
  it("replaces the form with a confirmation, and only then", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    fillMinimum();
    send();

    const confirmation = await screen.findByRole("status");

    expect(confirmation).toHaveTextContent(/thanks for contributing/i);
    expect(confirmation).toHaveTextContent(/we’ll look this one up/i);
    expect(screen.queryByRole("button", { name: /send this suggestion/i })).not.toBeInTheDocument();
  });

  /*
   * Somebody who knows one missing shop often knows two. The second one starts
   * blank rather than as the first one edited.
   */
  it("offers a blank form for a second suggestion", async () => {
    vi.stubGlobal("fetch", accepted());

    renderSuggestion();
    fillMinimum();
    send();
    await screen.findByRole("status");

    fireEvent.click(screen.getByRole("button", { name: /suggest another shop/i }));

    expect(screen.getByLabelText(/^shop name/i)).toHaveValue("");
    expect(screen.getByLabelText(/^country/i)).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send this suggestion/i }),
    ).toBeInTheDocument();
  });
});
