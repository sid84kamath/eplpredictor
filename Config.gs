const BASE_URL = "https://eplpredictor.pages.dev";
const SHEET_ID = "1x1x-AODInrXF1FYNMls63GdQt96EdSl_LmRysok-jcM";
const PLAYERS = [
  { name: "Siddharth", email: "sid84kamath@gmail.com" },
  { name: "Neha", email: "neha19shah@gmail.com" },
  { name: "Aditya", email: "adimails@gmail.com" },
  { name: "Atulya", email: "atulyasv@gmail.com" },
  {name: "Shreyans", email: "shreyansshah008@gmail.com"},
  {name: "Shantanu", email: "shantanukulkarni17@gmail.com"},
  {name: "Raunak", email: "phade.raunak@gmail.com"},
  {name: "Sid Kulkarni", email: "siddharth1329@gmail.com"}
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

function fetchWithRetry(url, attempts) {
  attempts = attempts || 4;
  var delays = [2000, 5000, 10000, 15000];

  for (var i = 0; i < attempts; i++) {
    try {
      Utilities.sleep(delays[i]);
      var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var code = res.getResponseCode();
      Logger.log('Attempt ' + (i+1) + ' — HTTP ' + code);
      if (code === 200) return res;
      Logger.log('Response: ' + res.getContentText().substring(0, 200));
    } catch(e) {
      Logger.log('Attempt ' + (i+1) + ' failed: ' + e.message);
    }
  }
  throw new Error('All ' + attempts + ' attempts failed for ' + url);
}
