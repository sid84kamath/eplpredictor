const BASE_URL = "https://eplpredictor.pages.dev";
const FOOTBALL_API_BASE_URL = "https://api.football-data.org/v4";
const FOOTBALL_API_PROXY_URL = "https://epl.sid84kamath.workers.dev";
const FOOTBALL_DATA_API_KEY = "09fedeb5e296477dbb31b5072e3612b1";
const SHEET_ID = "1x1x-AODInrXF1FYNMls63GdQt96EdSl_LmRysok-jcM";
const PLAYERS = [
  { name: "Siddharth", email: "sid84kamath@gmail.com" }
];
const EMAILS = PLAYERS.map(function(player) {
  return player.email;
});

function getPlayerNameByEmail(email) {
  for (var i = 0; i < PLAYERS.length; i++) {
    if (PLAYERS[i].email === email) {
      return PLAYERS[i].name;
    }
  }

  throw new Error("No player mapping found for email: " + email);
}

function getUpcomingGameweekMatches(matches, now) {
  var referenceTime = now || new Date();
  var upcomingMatches = matches
    .filter(function(match) {
      return match && match.utcDate && new Date(match.utcDate) > referenceTime;
    })
    .sort(function(a, b) {
      return new Date(a.utcDate) - new Date(b.utcDate);
    });

  if (upcomingMatches.length === 0) {
    return [];
  }

  var firstMatch = upcomingMatches[0];
  var targetMatchday = firstMatch.matchday;

  if (targetMatchday === undefined || targetMatchday === null || targetMatchday === '') {
    return upcomingMatches;
  }

  return matches
    .filter(function(match) {
      return match && match.matchday === targetMatchday;
    })
    .sort(function(a, b) {
      return new Date(a.utcDate) - new Date(b.utcDate);
    });
}

function getGameweekKey(matches) {
  return matches
    .map(function(match) {
      return String(match.id);
    })
    .sort()
    .join("|");
}

function getPreviousGameweekCompletionState(matches, now) {
  var referenceTime = now || new Date();
  var upcomingGameweek = getUpcomingGameweekMatches(matches, referenceTime);

  if (upcomingGameweek.length === 0) {
    return getLatestGameweekCompletionState_(matches);
  }

  var upcomingMatchday = upcomingGameweek[0].matchday;
  if (upcomingMatchday === undefined || upcomingMatchday === null || upcomingMatchday === '') {
    return {
      allFinished: false,
      finishedFixtures: 0,
      gameweekKey: "",
      matchday: null,
      totalFixtures: 0
    };
  }

  var candidateMatchdays = matches
    .map(function(match) {
      return Number(match.matchday);
    })
    .filter(function(matchday) {
      return !isNaN(matchday) && matchday < Number(upcomingMatchday);
    });

  if (candidateMatchdays.length === 0) {
    return {
      allFinished: false,
      finishedFixtures: 0,
      gameweekKey: "",
      matchday: null,
      totalFixtures: 0
    };
  }

  var previousMatchday = Math.max.apply(null, candidateMatchdays);
  return getGameweekCompletionState_(matches, previousMatchday);
}

function getLatestGameweekCompletionState_(matches) {
  var matchdays = matches
    .map(function(match) {
      return Number(match.matchday);
    })
    .filter(function(matchday) {
      return !isNaN(matchday);
    });

  if (matchdays.length === 0) {
    return {
      allFinished: false,
      finishedFixtures: 0,
      gameweekKey: "",
      matchday: null,
      totalFixtures: 0
    };
  }

  return getGameweekCompletionState_(matches, Math.max.apply(null, matchdays));
}

function getGameweekCompletionState_(matches, matchday) {
  var gameweek = matches.filter(function(match) {
    return Number(match.matchday) === Number(matchday);
  });

  if (gameweek.length === 0) {
    return {
      allFinished: false,
      finishedFixtures: 0,
      gameweekKey: "",
      matchday: matchday,
      totalFixtures: 0
    };
  }

  var finishedFixtures = gameweek.filter(function(match) {
    return match.status === 'FINISHED';
  }).length;

  return {
    allFinished: finishedFixtures === gameweek.length,
    finishedFixtures: finishedFixtures,
    gameweekKey: getGameweekKey(gameweek),
    matchday: matchday,
    totalFixtures: gameweek.length
  };
}

function getStateValue_(stateSheet, key, fallbackA1) {
  var row = findStateRow_(stateSheet, key);
  if (row) {
    return stateSheet.getRange(row, 2).getValue();
  }

  return fallbackA1 ? stateSheet.getRange(fallbackA1).getValue() : '';
}

function setStateValue_(stateSheet, key, value, fallbackA1) {
  var row = findStateRow_(stateSheet, key);
  if (row) {
    stateSheet.getRange(row, 2).setValue(value);
    return;
  }

  if (fallbackA1) {
    stateSheet.getRange(fallbackA1).setValue(value);
    return;
  }

  stateSheet.appendRow([key, value]);
}

function findStateRow_(stateSheet, key) {
  var lastRow = stateSheet.getLastRow();
  if (lastRow < 1) {
    return null;
  }

  var keys = stateSheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) {
      return i + 1;
    }
  }

  return null;
}

function fetchFootballData(path, attempts) {
  var normalizedPath = path.charAt(0) === "/" ? path : "/" + path;
  var directUrl = FOOTBALL_API_BASE_URL + normalizedPath;
  var proxyUrl = FOOTBALL_API_PROXY_URL + normalizedPath;

  try {
    return fetchWithRetry(directUrl, attempts, {
      headers: { "X-Auth-Token": getFootballDataApiKey_() },
      muteHttpExceptions: true
    });
  } catch (directError) {
    Logger.log("Direct football-data.org fetch failed, falling back to Worker proxy: " + directError.message);
    return fetchWithRetry(proxyUrl, attempts);
  }
}

function getFootballDataApiKey_() {
  return PropertiesService.getScriptProperties().getProperty("FOOTBALL_DATA_API_KEY") || FOOTBALL_DATA_API_KEY;
}

function fetchWithRetry(url, attempts, params) {
  attempts = attempts || 4;
  params = params || {};

  var delays = [0, 2000, 5000, 10000];
  var lastError = '';

  for (var i = 0; i < attempts; i++) {
    if (delays[i]) {
      Utilities.sleep(delays[i]);
    }

    try {
      var requestParams = Object.assign({ muteHttpExceptions: true }, params);
      var res  = UrlFetchApp.fetch(url, requestParams);
      var code = res.getResponseCode();
      Logger.log('Attempt ' + (i+1) + ' — HTTP ' + code + ' — ' + url);

      if (code >= 200 && code < 300) {
        return res;
      }

      var responseText = res.getContentText().substring(0, 500);
      lastError = 'HTTP ' + code + ': ' + responseText;
      Logger.log('Response: ' + responseText);
    } catch(e) {
      lastError = e.message;
      Logger.log('Attempt ' + (i+1) + ' failed: ' + e.message);
    }
  }

  throw new Error('All ' + attempts + ' attempts failed for ' + url + (lastError ? ' — last error: ' + lastError : ''));
}
