function checkAndSendPredictions() {
  const BASE_APP_URL = "https://eplpredictor.pages.dev";
  const PREDICTION_GAMEWEEK_SENT_CELL = "B6";
  const YOUR_NAME = "Siddharth Kamath"; // change to your name

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const stateSheet = ss.getSheetByName("State");

  const lastSent = stateSheet.getRange("B2").getValue();
  const lastSentGameweekKey = String(stateSheet.getRange(PREDICTION_GAMEWEEK_SENT_CELL).getValue() || "");

  // 🔥 Fetch fixtures via your worker
  const res = fetchWithRetry("https://epl.sid84kamath.workers.dev/competitions/PL/matches");

  const data = JSON.parse(res.getContentText());

  const now = new Date();

  const gameweek = getUpcomingGameweekMatches(data.matches, now);
  const previousGameweekState = getPreviousGameweekCompletionState(data.matches, now);

  if (gameweek.length === 0) {
    Logger.log("No upcoming matches");
    return;
  }

  // next match = gameweek anchor
  const nextMatchDate = new Date(gameweek[0].utcDate);

  // normalize date (important)
  const nextDateStr = nextMatchDate.toISOString().split("T")[0];
  const currentGameweekKey = getGameweekKey(gameweek);

  Logger.log("Next match date:", nextDateStr);
  Logger.log("Last sent:", lastSent);
  Logger.log("Current gameweek key:", currentGameweekKey);
  Logger.log("Last sent gameweek key:", lastSentGameweekKey);
  Logger.log("Previous gameweek matchday:", previousGameweekState.matchday);

  if (previousGameweekState.totalFixtures === 0) {
    Logger.log("No previous gameweek fixtures found; skipping prediction emails");
    return;
  }

  if (!previousGameweekState.allFinished) {
    Logger.log("Previous gameweek is not finished yet (" + previousGameweekState.finishedFixtures + "/" + previousGameweekState.totalFixtures + " matches finished)");
    return;
  }

  // 🧠 KEY LOGIC
  if (currentGameweekKey === lastSentGameweekKey) {
    Logger.log("Already sent for this gameweek");
    return;
  }
  Logger.log("Previous gameweek is complete; sending emails for upcoming gameweek with " + gameweek.length + " matches");

  const fixtureSheet = ss.getSheetByName("Fixtures");
  const fixtureData = fixtureSheet.getDataRange().getValues();
  const currentFixtureGameweekKey = getGameweekKey(
    fixtureData.slice(1)
      .filter(function(row) { return row[0]; })
      .map(function(row) {
        return { id: row[0] };
      })
  );

  // 📧 Send to all users
  EMAILS.forEach(email => {

  const link = `${BASE_APP_URL}?email=${encodeURIComponent(email)}`;

  const kickoffDate = nextMatchDate.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  MailApp.sendEmail({
    to: email,
    subject: "⚽ New Gameweek — Submit Your EPL Predictions",
    htmlBody: `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:Georgia, serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#38003c;border-radius:14px 14px 0 0;padding:28px 32px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;
                text-transform:uppercase;color:#e8b4f8;">Premier League</p>
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">
                New Gameweek<br>is Live ⚽
              </h1>
              <p style="margin:10px 0 0;font-size:13px;color:#c084d4;">
                First match: ${kickoffDate}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#111111;padding:28px 32px;">

              <p style="margin:0 0 20px;font-size:15px;color:#aaaaaa;line-height:1.7;">
                The fixtures are set. Make your predictions before the first ball is kicked —
                late entries won't count.
              </p>

              <!-- Scoring -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#1a1a1a;border:1px solid #242424;border-radius:10px;
                margin-bottom:24px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #242424;">
                    <span style="font-size:18px;">✅</span>
                    <span style="margin-left:10px;font-size:14px;color:#f0f0f0;font-weight:600;">
                      Exact score
                    </span>
                    <span style="float:right;background:#00e67622;color:#00e676;font-size:13px;
                      font-weight:700;padding:2px 10px;border-radius:99px;border:1px solid #00e67644;">
                      3 pts
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #242424;">
                    <span style="font-size:18px;">☑️</span>
                    <span style="margin-left:10px;font-size:14px;color:#f0f0f0;font-weight:600;">
                      Correct result
                    </span>
                    <span style="float:right;background:#2563eb22;color:#60a5fa;font-size:13px;
                      font-weight:700;padding:2px 10px;border-radius:99px;border:1px solid #2563eb44;">
                      1 pt
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="font-size:18px;">❌</span>
                    <span style="margin-left:10px;font-size:14px;color:#f0f0f0;font-weight:600;">
                      Wrong
                    </span>
                    <span style="float:right;background:#ff4d4d22;color:#ff4d4d;font-size:13px;
                      font-weight:700;padding:2px 10px;border-radius:99px;border:1px solid #ff4d4d44;">
                      0 pts
                    </span>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <a href="${link}"
                      style="display:inline-block;background:#00e676;color:#000000;
                      font-size:16px;font-weight:800;letter-spacing:0.02em;
                      padding:16px 40px;border-radius:12px;text-decoration:none;">
                      Submit My Predictions →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#444;text-align:center;line-height:1.6;">
                Link is personal to you — don't share it.<br>
                Predictions lock once the first match kicks off.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d0d;border-radius:0 0 14px 14px;padding:16px 32px;
              border-top:1px solid #1a1a1a;">
              <p style="margin:0;font-size:11px;color:#333;text-align:center;">
                EPL Predictions · Sent by ${YOUR_NAME}
              </p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
    </body>
    </html>`
    });
  });

  // ✅ update state
  stateSheet.getRange("B2").setValue(nextDateStr);
  stateSheet.getRange(PREDICTION_GAMEWEEK_SENT_CELL).setValue(currentGameweekKey);

  if (currentFixtureGameweekKey === currentGameweekKey) {
    Logger.log("Marking current fixture rows as processed");
    for (let i = 1; i < fixtureData.length; i++) {
      if (fixtureData[i][0]) {
        fixtureSheet.getRange(i + 1, 5).setValue(true);
      }
    }
  } else {
    Logger.log("Skipping processed-flag update because Fixtures sheet does not match the emailed gameweek");
  }

  Logger.log("Emails sent + state updated");
}
