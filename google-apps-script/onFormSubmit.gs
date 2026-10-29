/**
 * Google Apps Script: e-mails the player automatically when the Google Form is submitted.
 *
 * Setup (one time):
 *  1. Open the form's response sheet > Extensions > Apps Script, paste this file, save.
 *  2. Project Settings > Script properties, add:
 *       WEBHOOK_URL    = https://<your-app-domain>/api/webhook/form-submit
 *       WEBHOOK_SECRET = same value as FORM_WEBHOOK_SECRET on the server
 *  3. Triggers > Add trigger: function onFormSubmit, event source "From spreadsheet", event type "On form submit".
 *     Approve the permission prompt.
 *
 * What happens per submission: the app creates the player (in-game user-id), generates the unique tickets,
 * sends the e-mail from the configured Gmail account and ticks success_sent_email_1 in its database.
 * The result is written to the "Email Sent" column of the submitted row ("✓ acc001" or "✗ reason").
 */

const STATUS_HEADER = "Email Sent";
const MAX_ATTEMPTS = 3;

function onFormSubmit(e) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("WEBHOOK_URL");
  const secret = props.getProperty("WEBHOOK_SECRET");
  const sheet = e.range.getSheet();
  const row = e.range.getRow();

  if (!url || !secret) {
    writeStatus_(sheet, row, "✗ WEBHOOK_URL / WEBHOOK_SECRET not set");
    return;
  }

  // Match columns by header text so the order of the form questions does not matter.
  const pick = (test) => {
    for (const header in e.namedValues) {
      if (test(header.toLowerCase())) return String(e.namedValues[header][0] || "").trim();
    }
    return "";
  };
  const payload = {
    name: pick((h) => /^name\b/.test(h)),
    email: pick((h) => /e-?mail/.test(h)),
    tickets: pick((h) => /ticket/.test(h) && !/screenshot|payment|proof|attachment/.test(h)),
  };

  let result = { error: "No response from server" };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: { "x-webhook-secret": secret },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      let body = {};
      try {
        body = JSON.parse(res.getContentText() || "{}");
      } catch (_) {}
      if (code === 200 && body.emailSent) {
        result = body;
        break;
      }
      result = { error: body.error || body.emailError || "HTTP " + code };
      if (code >= 400 && code < 500) break; // bad input / auth: retrying will not help
    } catch (err) {
      result = { error: String(err) };
    }
    Utilities.sleep(3000 * attempt);
  }

  writeStatus_(sheet, row, result.userId && !result.error ? "✓ " + result.userId : "✗ " + result.error);
}

function writeStatus_(sheet, row, text) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let col = headers.indexOf(STATUS_HEADER) + 1;
  if (!col) {
    col = lastCol + 1;
    sheet.getRange(1, col).setValue(STATUS_HEADER);
  }
  sheet.getRange(row, col).setValue(text);
}
