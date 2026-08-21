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
  if ((action === 'check' || e.parameter.check === '1') && email) {
    var predSheet  = ss.getSheetByName('Predictions');
    var predData   = predSheet.getDataRange().getValues();
    var requestedMatchIds = getRequestedMatchIds_(e.parameter.matchIds);
    var predictedMatchIds = [];
    var predictionsByMatchId = {};

    for (var i = 1; i < predData.length; i++) {
      var row = predData[i];
      var matchId = String(row[2] || '');

      if (String(row[1]) !== email || !matchId) {
        continue;
      }

      if (requestedMatchIds && requestedMatchIds[matchId] !== true) {
        continue;
      }

      if (!predictionsByMatchId[matchId]) {
        predictedMatchIds.push(matchId);
        predictionsByMatchId[matchId] = {
          home_pred: parseInt(row[3], 10),
          away_pred: parseInt(row[4], 10)
        };
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        predictedMatchIds: predictedMatchIds,
        predictions: predictionsByMatchId
      }))
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
      if (String(row[1]) === email) {
        existingMatchIds[String(row[2])] = true;
      }
    }

    var duplicateMatchIds = predictions
      .filter(function(prediction) {
        return existingMatchIds[prediction.match_id] === true;
      })
      .map(function(prediction) {
        return prediction.match_id;
    });

    if (duplicateMatchIds.length > 0) {
      return ContentService
        .createTextOutput(JSON.stringify({
          status: 'duplicate',
          duplicateMatchIds: duplicateMatchIds
        }))
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

function getRequestedMatchIds_(rawMatchIds) {
  if (!rawMatchIds) {
    return null;
  }

  return String(rawMatchIds)
    .split(',')
    .map(function(matchId) {
      return String(matchId).trim();
    })
    .filter(function(matchId) {
      return matchId;
    })
    .reduce(function(matchIds, matchId) {
      matchIds[matchId] = true;
      return matchIds;
    }, {});
}
