// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { fieldsFor, type ContributionKind } from "./contribute-schema";

function script() {
  const tabs = new Map<string, { rows: string[][] }>();
  const releaseLock = vi.fn();
  const tryLock = vi.fn(() => true);
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "test-secret" }) },
    LockService: { getScriptLock: () => ({ tryLock, releaseLock }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: (name: string) => tabs.has(name) ? sheet(name) : null,
      insertSheet: (name: string) => { tabs.set(name, { rows: [] }); return sheet(name); },
    }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }) },
    console: { error: vi.fn() },
  };
  function sheet(name: string) {
    const tab = tabs.get(name)!;
    return {
      appendRow: (row: string[]) => tab.rows.push(Array.from(row)),
      setFrozenRows: vi.fn(), getLastRow: () => tab.rows.length,
      getRange: () => ({ getValues: () => [tab.rows[0]] }),
    };
  }
  const api = runInNewContext(readFileSync("scripts/apps-script/contribute.gs", "utf8") + "\n({ doPost, SHEETS, CAPS })", context);
  const post = (type: string, fields: Record<string, string> = {}, secret = "test-secret") => api.doPost({ postData: { contents: JSON.stringify({ type, fields, secret }) } });
  return { api, post, tabs, tryLock, releaseLock };
}

describe("deployed Apps Script source contract", () => {
  it.each([
    ["suggestion", "suggestions"], ["correction", "corrections"], ["bug", "bugs"], ["feedback", "feedback"],
  ] as const)("creates %s tab, matches fields/caps, and preserves reviewer ownership", (kind: ContributionKind, name) => {
    const { api, post, tabs, releaseLock } = script();
    for (const field of fieldsFor(kind)) {
      expect(api.SHEETS[kind].columns).toContain(field.name);
      expect(api.CAPS[field.name]).toBe(field.maxLength);
    }
    expect(post(kind, { message: " =IMPORTXML(1)", what_happened: " +formula", status: "done", admin_notes: "forged", timestamp: "forged" }).ok).toBe(true);
    const headers = tabs.get(name)!.rows[0]!;
    const row = tabs.get(name)!.rows[1]!;
    expect(headers).toEqual(Array.from(api.SHEETS[kind].columns));
    expect(row[0]).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(row[headers.indexOf("status")]).toBe("");
    expect(row[headers.indexOf("admin_notes")]).toBe("");
    if (kind === "feedback") expect(row[headers.indexOf("message")]).toBe("'=IMPORTXML(1)");
    if (kind === "bug") expect(row[headers.indexOf("what_happened")]).toBe("'+formula");
    expect(releaseLock).toHaveBeenCalledOnce();
    expect(post(kind).ok).toBe(true);
    expect(tabs.get(name)!.rows).toHaveLength(3);
  });

  it("enforces the exact new column order", () => {
    const { api } = script();
    expect(Array.from(api.SHEETS.bug.columns)).toEqual(["timestamp", "category", "what_happened", "what_were_you_trying_to_do", "page_path", "device_summary", "signed_in", "contributor_name", "contributor_email", "status", "admin_notes"]);
    expect(Array.from(api.SHEETS.feedback.columns)).toEqual(["timestamp", "feedback_type", "message", "page_path", "contributor_name", "contributor_email", "status", "admin_notes"]);
  });

  it("refuses wrong secrets, unknown/inherited types, lock contention and header drift", () => {
    const { post, tabs, tryLock, releaseLock } = script();
    expect(post("bug", {}, "wrong").error).toBe("forbidden");
    for (const kind of ["unknown", "__proto__", "constructor", "toString"]) expect(post(kind).error).toBe("unknown_type");
    expect(tabs.size).toBe(0);
    tryLock.mockReturnValueOnce(false);
    expect(post("bug").error).toBe("busy");
    expect(tabs.size).toBe(0);
    post("bug");
    tabs.get("bugs")!.rows[0]![1] = "wrong header";
    expect(post("bug").error).toBe("internal_error");
    expect(tabs.get("bugs")!.rows).toHaveLength(2);
    expect(releaseLock).toHaveBeenCalledTimes(2);
  });

  it("caps new text fields and escapes each formula prefix", () => {
    const { post, tabs } = script();
    for (const prefix of ["=", "+", "-", "@"]) post("feedback", { message: ` ${prefix}${"x".repeat(2100)}` });
    for (const row of tabs.get("feedback")!.rows.slice(1)) {
      expect(row[2]).toMatch(/^'[=+\-@]/);
      expect(row[2]).toHaveLength(2013);
      expect(row[2]).toMatch(/ \[truncated\]$/);
    }
  });
});
