const BASE_URL = "epl-predictor-us.netlify.app";
const EMAILS = ["sid84kamath@gmail.com","neha19shah@gmail.com"]; // update
const SHEET_ID = "1x1x-AODInrXF1FYNMls63GdQt96EdSl_LmRysok-jcM";

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