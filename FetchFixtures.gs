function fetchFixtures() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Fixtures");

  const res = fetchFootballData("/competitions/PL/matches");
  const data = JSON.parse(res.getContentText());

  const matches = (data.matches || []).filter(function(match) {
    return match && match.utcDate && new Date(match.utcDate) > new Date();
  });

  if (matches.length === 0) {
    Logger.log("No scheduled matches");
    clearFixtureRows_(sheet);
    return;
  }

  const now = new Date();
  const gameweek = getUpcomingGameweekMatches(matches, now);

  if (gameweek.length === 0) {
    Logger.log("No upcoming matches");
    clearFixtureRows_(sheet);
    return;
  }

  // First upcoming match
  const firstDate = new Date(gameweek[0].utcDate);
  const firstDateStr = firstDate.toISOString().split("T")[0];
  const matchday = gameweek[0].matchday;
  Logger.log("First match date from API: " + firstDateStr);
  Logger.log("Current gameweek matchday: " + matchday);
  Logger.log("Gameweek matches to add: " + gameweek.length);

  const processedByMatchId = getProcessedFixtureState_(sheet);
  clearFixtureRows_(sheet);

  // Replace the Fixtures sheet with only the current upcoming gameweek.
  // This keeps old season rows (for example August 2025 fixtures) from lingering
  // when football-data.org returns a full-season match list.
  gameweek.forEach(function(m) {
    Logger.log("Adding match " + m.id + " on " + m.utcDate);
    sheet.appendRow([
      m.id,
      m.utcDate,
      m.homeTeam.name,
      m.awayTeam.name,
      processedByMatchId[String(m.id)] === true
    ]);
  });

  Logger.log("Replaced Fixtures sheet with " + gameweek.length + " current gameweek matches");
}

function getProcessedFixtureState_(sheet) {
  const data = sheet.getDataRange().getValues();
  const processedByMatchId = {};

  for (let i = 1; i < data.length; i++) {
    const matchId = data[i][0];
    if (matchId) {
      processedByMatchId[String(matchId)] = data[i][4] === true;
    }
  }

  return processedByMatchId;
}

function clearFixtureRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}
