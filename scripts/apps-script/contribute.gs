/**
 * Nib Atlas contribution intake.
 *
 * Deployed as a Google Apps Script Web App bound to the intake spreadsheet, and
 * called only by the Cloudflare Worker route `POST /api/contribute`. The browser
 * never reaches this script: the deployment URL and the shared secret are Worker
 * secrets, so a public endpoint that writes to a spreadsheet is never exposed to
 * a page. Nothing here sets CORS headers, deliberately — a browser calling this
 * directly would be a misconfiguration, not a supported path.
 *
 * Setup and deployment: `docs/runbooks/contribution-intake.md`.
 *
 * This file is the source of truth. Paste it into the bound script project; do
 * not edit it in the Apps Script editor without bringing the change back here.
 */

/** Sheet tabs and their exact column order. The Worker sends these keys. */
var SHEETS = {
  suggestion: {
    name: "suggestions",
    columns: [
      "timestamp",
      "shop_name",
      "local_name",
      "city",
      "country",
      "address_or_map_link",
      "website_or_social",
      "why_worth_visiting",
      "contributor_name",
      "contributor_email",
      "status",
      "admin_notes",
    ],
  },
  correction: {
    name: "corrections",
    columns: [
      "timestamp",
      "shop_slug",
      "shop_name",
      "correction_type",
      "what_is_wrong",
      "source_or_link",
      "contributor_name",
      "contributor_email",
      "status",
      "admin_notes",
    ],
  },
};

/**
 * Per-field length caps.
 *
 * The Worker validates first and rejects anything oversized, so a value arriving
 * here over the cap means the Worker was bypassed or has drifted. Truncating
 * rather than rejecting keeps a real submission from being lost to a mismatch,
 * and the row records that it happened.
 */
var CAPS = {
  shop_name: 200,
  local_name: 200,
  city: 120,
  country: 120,
  address_or_map_link: 500,
  website_or_social: 500,
  why_worth_visiting: 2000,
  shop_slug: 200,
  correction_type: 60,
  what_is_wrong: 2000,
  source_or_link: 500,
  contributor_name: 120,
  contributor_email: 254,
};

/** Columns the reviewing team owns. The script never writes them. */
var REVIEW_COLUMNS = ["status", "admin_notes"];

function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty(
      "CONTRIBUTE_SHARED_SECRET"
    );

    if (!secret) {
      return json(500, { ok: false, error: "not_configured" });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return json(400, { ok: false, error: "empty_body" });
    }

    var body;

    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return json(400, { ok: false, error: "invalid_json" });
    }

    /*
     * Constant-time-ish comparison. Apps Script offers no timing-safe compare and
     * this endpoint is not a plausible timing-attack target behind a Worker, but
     * comparing lengths first and never short-circuiting on the first differing
     * character costs nothing.
     */
    if (!secretMatches(String(body.secret || ""), secret)) {
      return json(403, { ok: false, error: "forbidden" });
    }

    var config = SHEETS[body.type];

    if (!config) {
      return json(400, { ok: false, error: "unknown_type" });
    }

    var row = buildRow(config, body.fields || {});

    /*
     * Two submissions arriving together must not land on the same row. The lock
     * is held only for the append, and a caller that cannot get it within ten
     * seconds is told to retry rather than being silently dropped.
     */
    var lock = LockService.getScriptLock();

    if (!lock.tryLock(10000)) {
      return json(503, { ok: false, error: "busy" });
    }

    try {
      var sheet = sheetFor(config);
      sheet.appendRow(row);

      return json(200, { ok: true, row: sheet.getLastRow() });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    /*
     * Never return the raw error: it can carry spreadsheet ids and internal
     * paths, and it reaches a user-facing failure message. The detail goes to the
     * execution log, which the owner can read.
     */
    console.error(error);

    return json(500, { ok: false, error: "internal_error" });
  }
}

/**
 * A GET is not a supported route.
 *
 * Present so that opening the deployment URL in a browser says so plainly rather
 * than returning an Apps Script error page that looks like a misconfiguration.
 */
function doGet() {
  return json(405, { ok: false, error: "method_not_allowed" });
}

function secretMatches(candidate, expected) {
  if (candidate.length !== expected.length) {
    return false;
  }

  var difference = 0;

  for (var index = 0; index < expected.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

function buildRow(config, fields) {
  var now = new Date().toISOString();

  return config.columns.map(function (column) {
    if (column === "timestamp") {
      return now;
    }

    // The reviewing team's own columns start empty and stay theirs.
    if (REVIEW_COLUMNS.indexOf(column) !== -1) {
      return "";
    }

    return clean(fields[column], CAPS[column] || 500);
  });
}

/**
 * Everything written to the sheet is text, and never a formula.
 *
 * A leading `=`, `+`, `-` or `@` in a submitted value is what Sheets reads as a
 * formula, which is how a spreadsheet becomes an injection target for whoever
 * opens it. Prefixing an apostrophe makes the cell literal text without altering
 * what a reviewer reads.
 */
function clean(value, cap) {
  if (value === undefined || value === null) {
    return "";
  }

  var text = String(value).trim();

  if (text === "") {
    return "";
  }

  if (text.length > cap) {
    text = text.slice(0, cap) + " [truncated]";
  }

  if (["=", "+", "-", "@"].indexOf(text.charAt(0)) !== -1) {
    return "'" + text;
  }

  return text;
}

/**
 * The tab, created with its header row if it is not there.
 *
 * Makes the script the authority on column order rather than the manual setup,
 * so a tab renamed or a column inserted by hand cannot silently shift what lands
 * where. An existing tab whose headers disagree is left alone and reported.
 */
function sheetFor(config) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(config.name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(config.name);
    sheet.appendRow(config.columns);
    sheet.setFrozenRows(1);

    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(config.columns);
    sheet.setFrozenRows(1);

    return sheet;
  }

  var headers = sheet
    .getRange(1, 1, 1, config.columns.length)
    .getValues()[0]
    .map(function (header) {
      return String(header).trim();
    });

  for (var index = 0; index < config.columns.length; index += 1) {
    if (headers[index] !== config.columns[index]) {
      throw new Error(
        "Header mismatch in '" +
          config.name +
          "' at column " +
          (index + 1) +
          ": expected '" +
          config.columns[index] +
          "', found '" +
          headers[index] +
          "'"
      );
    }
  }

  return sheet;
}

/**
 * Apps Script Web Apps always answer 200, so the status is carried in the body
 * and the Worker reads `ok`. The argument is kept for readability at each call
 * site and to make the intended status obvious in the execution log.
 */
function json(status, payload) {
  var body = payload;
  body.status = status;

  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}
