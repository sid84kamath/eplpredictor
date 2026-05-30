function updateScores() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const predictionsSheet = ss.getSheetByName("Predictions");
  const leaderboardSheet = ss.getSheetByName("Leaderboard");
  const existingLeaderboard = getLeaderboardTotals_(leaderboardSheet);

  // Fetch finished matches from API
  const res = fetchFootballData("/competitions/PL/matches?status=FINISHED");
  const finishedMatches = JSON.parse(res.getContentText()).matches;

  if (!finishedMatches || finishedMatches.length === 0) {
    Logger.log("No finished matches to score");
    return;
  }

  // Create a map of match ID -> actual score for quick lookup
  const matchResults = {};
  finishedMatches.forEach(match => {
    matchResults[match.id] = {
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away
    };
  });

  Logger.log("Found " + finishedMatches.length + " finished matches");

  // Get all predictions
  const predData = predictionsSheet.getDataRange().getValues();
  const leaderboard = Object.assign({}, existingLeaderboard);
  const scoredRows = [];

  // Process each prediction
  for (let i = 1; i < predData.length; i++) {
    const row = predData[i];
    const email = String(row[1]);
    const playerName = getPlayerNameByEmail(email);
    const matchId = String(row[2]);
    const homePred = parseInt(row[3]);
    const awayPred = parseInt(row[4]);
    const alreadyScored = row[5]; // Column 6 = "scored"

    // Skip if already scored
    if (alreadyScored === true) {
      Logger.log("Skipping already-scored prediction at row " + (i + 1));
      continue;
    }

    // Skip if missing data
    if (!email || !matchId || isNaN(homePred) || isNaN(awayPred)) {
      Logger.log("Skipping incomplete prediction at row " + (i + 1));
      continue;
    }

    // Skip if match hasn't finished yet
    if (!matchResults[matchId]) {
      Logger.log("Match " + matchId + " not finished yet");
      continue;
    }

    const actual = matchResults[matchId];
    let points = 0;

    // Exact score: 3 points
    if (homePred === actual.homeScore && awayPred === actual.awayScore) {
      points = 3;
      Logger.log(playerName + " - Match " + matchId + ": Exact score prediction ✅ (+3 pts)");
    }
    // Correct result: 1 point
    else if (
      (homePred > awayPred && actual.homeScore > actual.awayScore) ||  // Home win
      (homePred < awayPred && actual.homeScore < actual.awayScore) ||  // Away win
      (homePred === awayPred && actual.homeScore === actual.awayScore)  // Draw
    ) {
      points = 1;
      Logger.log(playerName + " - Match " + matchId + ": Correct result prediction ✅ (+1 pt)");
    } else {
      Logger.log(playerName + " - Match " + matchId + ": Wrong prediction ❌ (0 pts)");
    }

    // Add to leaderboard
    leaderboard[playerName] = (leaderboard[playerName] || 0) + points;
    
    // Mark this row as scored (row number is i+1, but array index for getRange is i+1)
    scoredRows.push(i + 1);
  }

  if (scoredRows.length === 0) {
    Logger.log("No new predictions were scored");
    return false;
  }

  // Mark all scored predictions
  Logger.log("Marking " + scoredRows.length + " predictions as scored");
  scoredRows.forEach(rowNum => {
    predictionsSheet.getRange(rowNum, 6).setValue(true); // Column 6 = "scored"
  });

  // Update leaderboard sheet
  Logger.log("Updating leaderboard with " + Object.keys(leaderboard).length + " users");
  leaderboardSheet.clear();
  leaderboardSheet.appendRow(["Name", "Points"]);

  Object.entries(leaderboard)
    .sort((a, b) => b[1] - a[1])  // Sort by points descending
    .forEach(([name, pts]) => {
      leaderboardSheet.appendRow([name, pts]);
    });

  Logger.log("Leaderboard updated successfully");
  return true;
}

function getLeaderboardTotals_(leaderboardSheet) {
  const rows = leaderboardSheet.getDataRange().getValues();
  const totals = {};

  for (let i = 1; i < rows.length; i++) {
    const rawName = rows[i][0];
    if (!rawName) continue;

    const normalizedName = normalizeLeaderboardName_(String(rawName));
    totals[normalizedName] = (totals[normalizedName] || 0) + (Number(rows[i][1]) || 0);
  }

  return totals;
}

function normalizeLeaderboardName_(value) {
  if (value.indexOf("@") !== -1) {
    return getPlayerNameByEmail(value);
  }

  return value;
}
