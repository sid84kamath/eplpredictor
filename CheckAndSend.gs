function checkAndSendPredictions() {
  const BASE_APP_URL = "https://epl-predictor-us.netlify.app";

  const EMAILS = [
    "sid84kamath@gmail.com"
  ];
  const YOUR_NAME = "Siddharth Kamath"; // change to your name

  const SHEET_ID = "1x1x-AODInrXF1FYNMls63GdQt96EdSl_LmRysok-jcM";

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const stateSheet = ss.getSheetByName("State");

  const lastSent = stateSheet.getRange("B2").getValue();

  // 🔥 Fetch fixtures via your worker
  const res = fetchWithRetry("https://epl.sid84kamath.workers.dev/competitions/PL/matches");

  const data = JSON.parse(res.getContentText());

  const now = new Date();

  // get upcoming matches
  const upcoming = data.matches
    .filter(m => new Date(m.utcDate) > now)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  if (upcoming.length === 0) {
    Logger.log("No upcoming matches");
    return;
  }

  // next match = gameweek anchor
  const nextMatchDate = new Date(upcoming[0].utcDate);

  // normalize date (important)
  const nextDateStr = nextMatchDate.toISOString().split("T")[0];

  Logger.log("Next match date:", nextDateStr);
  Logger.log("Last sent:", lastSent);

  // 🧠 KEY LOGIC
  if (nextDateStr === lastSent) {
    Logger.log("Already sent for this gameweek");
    return;
  }

  // 🚀 SEND EMAILS
  const fixtureSheet = ss.getSheetByName("Fixtures");
  const fixtureData = fixtureSheet.getDataRange().getValues();

  // Find all matches in current gameweek and check if processed
  let gameweekProcessed = false;
  let gameweekRows = [];

  for (let i = 1; i < fixtureData.length; i++) {
    const row = fixtureData[i];
    let matchDate = '';
    
    try {
      if (row[1]) {
        const dateObj = new Date(row[1]);
        matchDate = dateObj.toISOString().split('T')[0];
      }
    } catch (e) {
      Logger.log("Date parse error at row " + (i + 1) + ": " + e.message);
      continue;
    }
    
    // Check if this match is within the gameweek (4-day window from anchor)
    const nextMatchDate = new Date(nextDateStr + 'T00:00:00Z');
    const matchDateObj = new Date(matchDate + 'T00:00:00Z');
    const diff = (matchDateObj - nextMatchDate) / (1000 * 60 * 60 * 24);
    
    Logger.log("Checking row " + (i + 1) + " - matchDate: " + matchDate + ", nextDateStr: " + nextDateStr + ", diff: " + diff + ", processed: " + row[4]);
    
    if (diff >= 0 && diff <= 4) {  // Within gameweek window
      gameweekRows.push(i + 1); // Store row numbers for updating
      if (row[4] === true) {
        gameweekProcessed = true;  // If any match in gameweek is processed, flag it
      }
    }
  }

  // If already processed, skip
  if (gameweekProcessed === true) {
    Logger.log("Emails already sent for this gameweek");
    return;
  }

  Logger.log("Found " + gameweekRows.length + " matches for gameweek, will send emails");

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

  // ✅ Mark ALL gameweek matches as processed
  Logger.log("Marking " + gameweekRows.length + " rows as processed");
  gameweekRows.forEach(rowNum => {
    fixtureSheet.getRange(rowNum, 5).setValue(true); // Column 5 = "processed"
  });

  // ✅ update state
  stateSheet.getRange("B2").setValue(nextDateStr);

  Logger.log("Emails sent + state updated");
}