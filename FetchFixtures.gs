function fetchFixtures() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Fixtures");

  const res = fetchWithRetry("https://epl.sid84kamath.workers.dev/competitions/PL/matches");
  const data = JSON.parse(res.getContentText());

  const matches = data.matches;

  if (!matches || matches.length === 0) {
    Logger.log("No scheduled matches");
    return;
  }

  const now = new Date();
  const gameweek = getUpcomingGameweekMatches(matches, now);

  if (gameweek.length === 0) {
    Logger.log("No upcoming matches");
    return;
  }

  // First upcoming match
  const firstDate = new Date(gameweek[0].utcDate);
  const firstDateStr = firstDate.toISOString().split("T")[0];
  const matchday = gameweek[0].matchday;
  Logger.log("First match date from API: " + firstDateStr);
  Logger.log("Current gameweek matchday: " + matchday);
  Logger.log("Gameweek matches to add: " + gameweek.length);

  // Clear old matches (anything before current gameweek anchor)
  const sheetData = sheet.getDataRange().getValues();
  for (let i = sheetData.length - 1; i > 0; i--) { // Start from end to avoid index shifting
    const rowDate = sheetData[i][1] ? String(new Date(sheetData[i][1]).toISOString()).split('T')[0] : '';
    if (rowDate < firstDateStr) {
      Logger.log("Deleting old row " + (i + 1) + " with date: " + rowDate);
      sheet.deleteRow(i + 1);
    }
  }

  // Append current gameweek matches
  let addedCount = 0;
  gameweek.forEach(m => {
    const exists = sheet.createTextFinder(m.id).findNext();
    if (exists) {
      Logger.log("Match " + m.id + " already exists, skipping");
      return;
    }

    Logger.log("Adding match " + m.id + " on " + m.utcDate);
    sheet.appendRow([
      m.id,
      m.utcDate,
      m.homeTeam.name,
      m.awayTeam.name,
      false
    ]);
    addedCount++;
  });

  Logger.log("Added " + addedCount + " new matches");
}
