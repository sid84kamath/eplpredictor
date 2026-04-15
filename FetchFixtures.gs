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

  // Filter for upcoming matches only
  const upcomingMatches = matches.filter(m => new Date(m.utcDate) > now);

  if (upcomingMatches.length === 0) {
    Logger.log("No upcoming matches");
    return;
  }

  // Sort by date
  upcomingMatches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  // First upcoming match
  const firstDate = new Date(upcomingMatches[0].utcDate);
  const firstDateStr = firstDate.toISOString().split("T")[0];
  Logger.log("First match date from API: " + firstDateStr);
  Logger.log("Total upcoming matches fetched: " + upcomingMatches.length);

  // Group gameweek (4-day window to capture full gameweek)
  const gameweek = upcomingMatches.filter(m => {
    const d = new Date(m.utcDate);
    const diff = (d - firstDate) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 4;
  });

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

  // Reset processed flag to false for all current gameweek matches (within 4-day window)
  const allData = sheet.getDataRange().getValues();
  let resetCount = 0;
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const rowDate = row[1] ? new Date(row[1]) : null;
    
    if (rowDate) {
      const diff = (rowDate - firstDate) / (1000 * 60 * 60 * 24);
      if (diff >= 0 && diff <= 4) {
        sheet.getRange(i + 1, 5).setValue(false);
        resetCount++;
      }
    }
  }

  Logger.log("Reset processed flag to false for " + resetCount + " gameweek matches");
}