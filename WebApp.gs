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
    var body      = JSON.parse(e.postData.contents);
    var email     = body.email;
    var batch     = Array.isArray(body.predictions) ? body.predictions : null;
    var timestamp = new Date();

    var ss         = SpreadsheetApp.openById('1x1x-AODInrXF1FYNMls63GdQt96EdSl_LmRysok-jcM');
    var sheet      = ss.getSheetByName('Predictions');
    var stateSheet = ss.getSheetByName('State');

    var currentDate = String(stateSheet.getRange("B2").getValue()).split('T')[0];
    var predictions = batch || [{
      match_id: body.match_id,
      home_pred: body.home_pred,
      away_pred: body.away_pred
    }];

    predictions = predictions
      .map(function(prediction) {
        var rawMatchId = prediction.match_id;
        var normalizedMatchId = rawMatchId === undefined || rawMatchId === null ? '' : String(rawMatchId).trim();

        return {
          match_id: normalizedMatchId,
          home_pred: prediction.home_pred,
          away_pred: prediction.away_pred
        };
      })
      .filter(function(prediction) {
        return prediction.match_id &&
          prediction.match_id !== 'undefined' &&
          prediction.match_id !== 'null' &&
          prediction.home_pred !== undefined &&
          prediction.away_pred !== undefined &&
          !isNaN(parseInt(prediction.home_pred, 10)) &&
          !isNaN(parseInt(prediction.away_pred, 10));
      });

    if (!email || predictions.length === 0) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'Missing email or predictions' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Get data, skip header row (start from index 1)
    var data = sheet.getDataRange().getValues();
    var existingMatchIds = {};
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      try {
        var rowDate = row[0] ? new Date(row[0]).toISOString().split('T')[0] : '';
        if (String(row[1]) === email && rowDate === currentDate) {
          existingMatchIds[String(row[2])] = true;
        }
      } catch(dateErr) {
        continue; // skip rows with unparseable dates
      }
    }

    var hasDuplicate = predictions.some(function(prediction) {
      return existingMatchIds[prediction.match_id] === true;
    });

    if (hasDuplicate) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'duplicate' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var rowsToAppend = predictions.map(function(prediction) {
      return [
        timestamp,
        email,
        prediction.match_id,
        parseInt(prediction.home_pred, 10),
        parseInt(prediction.away_pred, 10)
      ];
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', saved: rowsToAppend.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
