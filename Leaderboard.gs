const LEADERBOARD_EMAIL_HASH_CELL = "B3";
const LEADERBOARD_EMAIL_SENT_AT_CELL = "B4";
const LEADERBOARD_GAMEWEEK_SENT_CELL = "B5";
const LEADERBOARD_SENDER_NAME = "Siddharth Kamath";

function updateScoresAndSendLeaderboardEmail() {
  updateScores();
  sendLeaderboardEmailAfterGameweekComplete();
}

function sendLeaderboardEmail() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const leaderboardSheet = ss.getSheetByName("Leaderboard");

  if (!leaderboardSheet) {
    throw new Error('Leaderboard sheet not found');
  }

  const rows = leaderboardSheet.getDataRange().getValues();
  const leaderboard = rows
    .slice(1)
    .filter(row => row[0])
    .map(row => [String(row[0]), Number(row[1]) || 0])
    .sort((a, b) => b[1] - a[1]);

  const subject = "⚽ EPL Predictions Leaderboard";
  const htmlBody = buildLeaderboardEmailHtml(leaderboard, LEADERBOARD_SENDER_NAME);

  EMAILS.forEach(email => {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });
  });

  Logger.log('Leaderboard email sent to ' + EMAILS.length + ' recipient(s)');
}

function sendLeaderboardEmailIfChanged() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const stateSheet = ss.getSheetByName("State");

  if (!stateSheet) {
    throw new Error("State sheet not found");
  }

  const leaderboard = getLeaderboardDataForEmail_();
  const currentHash = buildLeaderboardHash_(leaderboard);
  const lastSentHash = String(stateSheet.getRange(LEADERBOARD_EMAIL_HASH_CELL).getValue() || "");

  if (currentHash === lastSentHash) {
    Logger.log("Leaderboard email already sent for current standings");
    return;
  }

  sendLeaderboardEmail();
  stateSheet.getRange(LEADERBOARD_EMAIL_HASH_CELL).setValue(currentHash);
  stateSheet.getRange(LEADERBOARD_EMAIL_SENT_AT_CELL).setValue(new Date());
  Logger.log("Stored leaderboard email state in " + LEADERBOARD_EMAIL_HASH_CELL);
}

function sendLeaderboardEmailAfterGameweekComplete() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const stateSheet = ss.getSheetByName("State");

  if (!stateSheet) {
    throw new Error("State sheet not found");
  }

  const res = fetchFootballData("/competitions/PL/matches");
  const data = JSON.parse(res.getContentText());
  const fixtureState = getPreviousGameweekCompletionState(data.matches || [], new Date());

  if (fixtureState.totalFixtures === 0) {
    Logger.log("No completed previous gameweek found; skipping leaderboard email");
    return;
  }

  if (!fixtureState.allFinished) {
    Logger.log("Previous gameweek is not finished yet (" + fixtureState.finishedFixtures + "/" + fixtureState.totalFixtures + " matches finished)");
    return;
  }

  const lastSentGameweekKey = String(stateSheet.getRange(LEADERBOARD_GAMEWEEK_SENT_CELL).getValue() || "");
  if (fixtureState.gameweekKey === lastSentGameweekKey) {
    Logger.log("Leaderboard email already sent for completed gameweek " + fixtureState.gameweekKey);
    return;
  }

  sendLeaderboardEmail();

  const leaderboard = getLeaderboardDataForEmail_();
  stateSheet.getRange(LEADERBOARD_EMAIL_HASH_CELL).setValue(buildLeaderboardHash_(leaderboard));
  stateSheet.getRange(LEADERBOARD_EMAIL_SENT_AT_CELL).setValue(new Date());
  stateSheet.getRange(LEADERBOARD_GAMEWEEK_SENT_CELL).setValue(fixtureState.gameweekKey);
  Logger.log("Leaderboard email sent for completed gameweek " + fixtureState.gameweekKey);
}

function buildLeaderboardEmailHtml(leaderboard, senderName) {
  const lastUpdated = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEE, d MMM yyyy h:mm a');

  const content = leaderboard.length
    ? buildLeaderboardRowsHtml(leaderboard)
    : '' +
      '<tr>' +
        '<td style="padding:40px 24px;text-align:center;color:#666666;font-size:14px;line-height:1.6;">' +
          '<div style="font-size:34px;line-height:1;margin-bottom:10px;">📊</div>' +
          'No scores yet.<br>Predictions will appear here as matches finish.' +
        '</td>' +
      '</tr>';

  return '' +
    '<!DOCTYPE html>' +
    '<html>' +
    '<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;padding:32px 16px;">' +
        '<tr>' +
          '<td align="center">' +
            '<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">' +
              '<tr>' +
                '<td style="padding:0 0 16px 0;text-align:center;">' +
                  '<div style="font-size:30px;line-height:1;color:#f0f0f0;font-weight:700;letter-spacing:0.04em;">⚽ Leaderboard</div>' +
                  '<div style="margin-top:6px;font-size:12px;color:#666666;letter-spacing:0.08em;text-transform:uppercase;">Premier League Predictions</div>' +
                '</td>' +
              '</tr>' +
              '<tr>' +
                '<td style="background:#111111;border:1px solid #242424;border-radius:14px;overflow:hidden;">' +
                  '<table width="100%" cellpadding="0" cellspacing="0" border="0">' +
                    '<tr>' +
                      '<td style="background:#1a1a1a;border-bottom:1px solid #242424;padding:16px;">' +
                        '<table width="100%" cellpadding="0" cellspacing="0" border="0">' +
                          '<tr>' +
                            '<td width="60" style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#666666;">Rank</td>' +
                            '<td style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#666666;">Player</td>' +
                            '<td width="80" align="right" style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#666666;">Points</td>' +
                          '</tr>' +
                        '</table>' +
                      '</td>' +
                    '</tr>' +
                    content +
                  '</table>' +
                '</td>' +
              '</tr>' +
              '<tr>' +
                '<td style="padding:16px 8px 0;text-align:center;font-size:11px;color:#666666;letter-spacing:0.04em;">' +
                  'Last updated: <span style="color:#00e676;font-weight:600;">' + escapeHtml(lastUpdated) + '</span>' +
                '</td>' +
              '</tr>' +
              '<tr>' +
                '<td style="padding:12px 8px 0;text-align:center;font-size:11px;color:#333333;">' +
                  'EPL Predictions · Sent by ' + escapeHtml(senderName) +
                '</td>' +
              '</tr>' +
            '</table>' +
          '</td>' +
        '</tr>' +
      '</table>' +
    '</body>' +
    '</html>';
}

function getLeaderboardDataForEmail_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const leaderboardSheet = ss.getSheetByName("Leaderboard");

  if (!leaderboardSheet) {
    throw new Error("Leaderboard sheet not found");
  }

  return leaderboardSheet.getDataRange().getValues()
    .slice(1)
    .filter(row => row[0])
    .map(row => [normalizeLeaderboardDisplayName_(String(row[0])), Number(row[1]) || 0])
    .sort((a, b) => b[1] - a[1]);
}

function buildLeaderboardHash_(leaderboard) {
  return leaderboard.map(function(row) {
    return row[0] + ":" + row[1];
  }).join("|");
}

function buildLeaderboardRowsHtml(leaderboard) {
  return leaderboard.map(function(row, index) {
    const rank = index + 1;
    const playerName = row[0] || 'Unknown';
    const points = row[1] || 0;
    const displayName = playerName.length > 24 ? playerName.substring(0, 24) + '...' : playerName;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#f0f0f0';
    const borderStyle = index === leaderboard.length - 1 ? '' : 'border-bottom:1px solid #242424;';

    return '' +
      '<tr>' +
        '<td style="padding:14px 16px;' + borderStyle + '">' +
          '<table width="100%" cellpadding="0" cellspacing="0" border="0">' +
            '<tr>' +
              '<td width="60" valign="middle" style="font-size:24px;font-weight:800;line-height:1;color:' + rankColor + ';text-align:center;">' + rank + (medal ? ' ' + medal : '') + '</td>' +
              '<td valign="middle" style="padding:0 12px;">' +
                '<div style="font-size:13px;color:#f0f0f0;font-weight:500;line-height:1.4;">' + escapeHtml(displayName) + '</div>' +
              '</td>' +
              '<td width="80" valign="middle" align="right">' +
                '<div style="font-size:20px;font-weight:800;line-height:1;color:#00e676;">' + points + '</div>' +
                '<div style="margin-top:3px;font-size:9px;color:#666666;letter-spacing:0.05em;text-transform:uppercase;">pts</div>' +
              '</td>' +
            '</tr>' +
          '</table>' +
        '</td>' +
      '</tr>';
  }).join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeLeaderboardDisplayName_(value) {
  if (value.indexOf("@") !== -1) {
    return getPlayerNameByEmail(value);
  }

  return value;
}
