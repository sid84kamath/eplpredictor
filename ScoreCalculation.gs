function updateScores() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const predictionsSheet = ss.getSheetByName("Predictions");
  const leaderboardSheet = ss.getSheetByName("Leaderboard");

  // Fetch finished matches from API
  const res = fetchWithRetry("https://epl.sid84kamath.workers.dev/competitions/PL/matches?status=FINISHED");
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
  const leaderboard = {};
  const scoredRows = [];

  // Process each prediction
  for (let i = 1; i < predData.length; i++) {
    const row = predData[i];
    const email = String(row[1]);
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
      Logger.log(email + " - Match " + matchId + ": Exact score prediction ✅ (+3 pts)");
    }
    // Correct result: 1 point
    else if (
      (homePred > awayPred && actual.homeScore > actual.awayScore) ||  // Home win
      (homePred < awayPred && actual.homeScore < actual.awayScore) ||  // Away win
      (homePred === awayPred && actual.homeScore === actual.awayScore)  // Draw
    ) {
      points = 1;
      Logger.log(email + " - Match " + matchId + ": Correct result prediction ✅ (+1 pt)");
    } else {
      Logger.log(email + " - Match " + matchId + ": Wrong prediction ❌ (0 pts)");
    }

    // Add to leaderboard
    leaderboard[email] = (leaderboard[email] || 0) + points;
    
    // Mark this row as scored (row number is i+1, but array index for getRange is i+1)
    scoredRows.push(i + 1);
  }

  // Mark all scored predictions
  Logger.log("Marking " + scoredRows.length + " predictions as scored");
  scoredRows.forEach(rowNum => {
    predictionsSheet.getRange(rowNum, 6).setValue(true); // Column 6 = "scored"
  });

  // Update leaderboard sheet
  Logger.log("Updating leaderboard with " + Object.keys(leaderboard).length + " users");
  leaderboardSheet.clear();
  leaderboardSheet.appendRow(["Email", "Points"]);

  Object.entries(leaderboard)
    .sort((a, b) => b[1] - a[1])  // Sort by points descending
    .forEach(([email, pts]) => {
      leaderboardSheet.appendRow([email, pts]);
    });

  Logger.log("Leaderboard updated successfully");
}