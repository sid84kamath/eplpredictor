function doGet(e) {
  var action = e.parameter.action;
  var email  = e.parameter.email;
  var ss     = SpreadsheetApp.openById('1x1x-AODInrXF1FYNMls63GdQt96EdSl_LmRysok-jcM');

  // ── Return fixtures for current gameweek ──
  if (action === 'fixtures') {
    var sheet    = ss.getSheetByName('Fixtures');
    var data     = sheet.getDataRange().getValues();
    var fixtures = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Only return SCHEDULED matches for current matchday
      if (row[7] === 'SCHEDULED') {
        fixtures.push({
          id:       row[1],
          matchday: row[0].replace('Matchday ', ''),
          homeTeam: { name: row[2], shortName: row[2] },
          awayTeam: { name: row[3], shortName: row[3] },
          utcDate:  row[4]
        });
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ matches: fixtures }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── Check if already submitted ──
  if (action === 'check' && email) {
    var predSheet  = ss.getSheetByName('Predictions');
    var stateSheet = ss.getSheetByName('State');
    var predData   = predSheet.getDataRange().getValues();
    var currentDate = String(stateSheet.getRange("B2").getValue()).split('T')[0];

    var alreadySubmitted = predData.some(function(row) {
      var rowDate = row[0] ? String(new Date(row[0]).toISOString()).split('T')[0] : '';
      return String(row[1]) === email && rowDate === currentDate;
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: alreadySubmitted ? 'duplicate' : 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'EPL Predictions API is live' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body     = JSON.parse(e.postData.contents);
    var email    = body.email;
    var match_id  = String(body.match_id);
    var home_pred = body.home_pred;
    var away_pred = body.away_pred;

    var ss         = SpreadsheetApp.openById('1x1x-AODInrXF1FYNMls63GdQt96EdSl_LmRysok-jcM');
    var sheet      = ss.getSheetByName('Predictions');
    var stateSheet = ss.getSheetByName('State');

    var currentDate = String(stateSheet.getRange("B2").getValue()).split('T')[0];

    // Get data, skip header row (start from index 1)
    var data = sheet.getDataRange().getValues();

    var alreadySubmitted = false;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      try {
        var rowDate = row[0] ? new Date(row[0]).toISOString().split('T')[0] : '';
        if (String(row[1]) === email && String(row[2]) === match_id && rowDate === currentDate) {
          alreadySubmitted = true;
          break;
        }
      } catch(dateErr) {
        continue; // skip rows with unparseable dates
      }
    }

    if (alreadySubmitted) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'duplicate' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([new Date(), email, match_id, home_pred, away_pred]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}