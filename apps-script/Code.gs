// === CONFIG ===
const SHEET_NAME = "Sessions";
const EXERCISES_SHEET_NAME = "Exercices";
const SHARED_TOKEN = "ersteinaquaticclub2026";
const DEDUPE_LOOKBACK_ROWS = 50;

// ======================================================
// Utils
// ======================================================
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(s) {
  return ContentService.createTextOutput(String(s))
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseDateAny_(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v || "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

// ======================================================
// Anti-doublon
// ======================================================
function isDuplicateSession_(sheet, s) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;

  const header = values[0].map(h => String(h).trim());
  const idx = (name) => header.indexOf(name);

  const iAth = idx("athleteName");
  const iDate = idx("sessionDate");
  const iSlot = idx("timeSlot");
  const iDur = idx("duration");
  const iRpe = idx("rpe");

  if ([iAth, iDate, iSlot, iDur, iRpe].some(i => i === -1)) return false;

  const startRow = Math.max(1, values.length - DEDUPE_LOOKBACK_ROWS);
  for (let r = values.length - 1; r >= startRow; r--) {
    const row = values[r];
    const same =
      String(row[iAth] || "").trim() === s.athleteName &&
      String(row[iDate] || "").trim() === s.sessionDate &&
      String(row[iSlot] || "").trim() === s.timeSlot &&
      Number(row[iDur] || 0) === Number(s.duration) &&
      Number(row[iRpe] || 0) === Number(s.rpe);

    if (same) return true;
  }
  return false;
}

// ======================================================
// POST : enregistrement séance
// ======================================================
function doPost(e) {
  try {
    const token = (e && e.parameter && e.parameter.token) ? e.parameter.token : "";
    if (token !== SHARED_TOKEN) return text_("Unauthorized");

    const raw = e.postData && e.postData.contents ? e.postData.contents : "";
    const data = JSON.parse(raw);

    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`Onglet introuvable: ${SHEET_NAME}`);

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h).trim());

    const idx = (name) => header.indexOf(name);
    const put = (row, name, val) => {
      const i = idx(name);
      if (i === -1) return;
      row[i] = val;
    };

    const athleteName = (data.athleteName || "").toString().trim();
    const sessionDate = (data.sessionDate || "").toString().trim();
    const timeSlot = (data.timeSlot || "").toString().trim();
    const duration = Number(data.duration);
    const distance = (data.distance === "" || data.distance === null || data.distance === undefined) ? "" : Number(data.distance);

    const rpe = Number(data.rpe);
    const performance = Number(data.performance);
    const engagement = Number(data.engagement);
    const fatigue = Number(data.fatigue);
    const comments = (data.comments || "").toString();
    const userAgent = (data.userAgent || "").toString();

    if (!athleteName || !sessionDate || !timeSlot || !Number.isFinite(duration) || !Number.isFinite(rpe)) {
      return text_("Error: Missing required fields");
    }

    const trainingLoad = duration * rpe;

    if (isDuplicateSession_(sheet, { athleteName, sessionDate, timeSlot, duration, rpe })) {
      return text_("OK");
    }

    const row = new Array(header.length).fill("");

    put(row, "timestamp_reception", new Date().toISOString());
    put(row, "athleteName", athleteName);
    put(row, "sessionDate", sessionDate);
    put(row, "timeSlot", timeSlot);
    put(row, "distance", distance);
    put(row, "duration", duration);
    put(row, "rpe", rpe);
    put(row, "performance", performance);
    put(row, "engagement", engagement);
    put(row, "fatigue", fatigue);
    put(row, "trainingLoad", trainingLoad);
    put(row, "comments", comments);
    put(row, "userAgent", userAgent);

    sheet.appendRow(row);

    return text_("OK");
  } catch (err) {
    return text_("Error: " + err.message);
  }
}

// ======================================================
// GET : healthcheck / récupération / Hall of Fame / Exercices
// ======================================================
function doGet(e) {
  const token = (e && e.parameter && e.parameter.token) ? e.parameter.token : "";
  if (token !== SHARED_TOKEN) return text_("Unauthorized (token manquant ou incorrect)");

  const actionRaw = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  const athleteNameParam = (e.parameter.athleteName || "").trim();
  const resolvedAction = actionRaw || (athleteNameParam ? "get" : "");

  if (!resolvedAction) {
    return text_("OK - endpoint actif (GET). Utiliser POST pour enregistrer une séance.");
  }

  if (resolvedAction === "get") {
    const athleteName = athleteNameParam;
    const limit = Math.min(parseInt(e.parameter.limit || "30", 10) || 30, 200);

    if (!athleteName) return json_({ ok: false, error: "athleteName manquant" });

    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) return json_({ ok: false, error: "Onglet introuvable: " + SHEET_NAME });

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return json_({ ok: true, sessions: [] });

    const header = values[0].map(h => String(h).trim());
    const idx = (name) => header.indexOf(name);

    const iAth = idx("athleteName");
    const iDate = idx("sessionDate");
    const iSlot = idx("timeSlot");
    const iDur = idx("duration");
    const iDist = idx("distance");
    const iRpe = idx("rpe");
    const iPerf = idx("performance");
    const iEng = idx("engagement");
    const iFat = idx("fatigue");
    const iCom = idx("comments");

    const safe = (row, i) => (i === -1 ? "" : row[i]);

    const out = [];
    for (let r = values.length - 1; r >= 1 && out.length < limit; r--) {
      const row = values[r];
      if (String(safe(row, iAth) || "").trim() !== athleteName) continue;

      const distRaw = safe(row, iDist);

      out.push({
        athleteName: String(safe(row, iAth) || ""),
        sessionDate: String(safe(row, iDate) || ""),
        timeSlot: String(safe(row, iSlot) || ""),
        duration: Number(safe(row, iDur) || 0),
        distance: (distRaw === "" || distRaw == null) ? null : Number(distRaw),
        rpe: Number(safe(row, iRpe) || 0),
        performance: Number(safe(row, iPerf) || 0),
        engagement: Number(safe(row, iEng) || 0),
        fatigue: Number(safe(row, iFat) || 0),
        comments: String(safe(row, iCom) || "")
      });
    }

    return json_({ ok: true, sessions: out });
  }

  if (resolvedAction === "hall") {
    const days = Math.min(Math.max(parseInt(e.parameter.days || "7", 10) || 7, 1), 365);

    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) return json_({ ok: false, error: "Onglet introuvable: " + SHEET_NAME });

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return json_({ ok: true, days, athletes: [] });

    const header = values[0].map(h => String(h).trim());
    const idx = (name) => header.indexOf(name);

    const iAth = idx("athleteName");
    const iDate = idx("sessionDate");
    const iDist = idx("distance");
    const iPerf = idx("performance");
    const iEng = idx("engagement");

    if ([iAth, iDate, iDist, iPerf, iEng].some(i => i === -1)) {
      return json_({
        ok: false,
        error: "Colonnes manquantes dans Sessions (attendues: athleteName, sessionDate, distance, performance, engagement)."
      });
    }

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);

    const agg = new Map();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const name = String(row[iAth] || "").trim();
      if (!name) continue;

      const dt = parseDateAny_(row[iDate]);
      if (!dt || dt < from) continue;

      const dist = Number(row[iDist] || 0);
      const perf = Number(row[iPerf]);
      const eng = Number(row[iEng]);

      const cur = agg.get(name) || { distanceSum: 0, perfSum: 0, perfCount: 0, engSum: 0, engCount: 0, sessionsCount: 0 };
      cur.sessionsCount += 1;
      if (isFinite(dist)) cur.distanceSum += dist;
      if (isFinite(perf)) { cur.perfSum += perf; cur.perfCount += 1; }
      if (isFinite(eng)) { cur.engSum += eng; cur.engCount += 1; }
      agg.set(name, cur);
    }

    const athletes = Array.from(agg.entries()).map(([athleteName, a]) => ({
      athleteName,
      sessionsCount: a.sessionsCount,
      distanceTotal: a.distanceSum,
      performanceAvg: a.perfCount ? (a.perfSum / a.perfCount) : null,
      engagementAvg: a.engCount ? (a.engSum / a.engCount) : null
    }));

    return json_({ ok: true, days, athletes });
  }

  if (resolvedAction === "exercises") {
    const sheet = SpreadsheetApp.getActive().getSheetByName(EXERCISES_SHEET_NAME);
    if (!sheet) return json_({ ok: false, error: "Onglet introuvable: " + EXERCISES_SHEET_NAME });

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return json_({ ok: true, exercises: [] });

    const header = values[0].map(h => String(h).trim());
    const idx = (name) => header.indexOf(name);
    const safe = (row, i) => (i === -1 ? "" : row[i]);

    const iNum = idx("numero_exercice");
    const iNom = idx("nom_exercice");
    const iDesc = idx("Description");
    const iSerieEnd = idx("Nb_series_endurance");
    const iRepEnd = idx("Nb_reps_endurance");
    const iPctEnd = idx("Pourcentage_charge_1RM_endurance");
    const iRecSerieEnd = idx("recup_series_endurance");
    const iRecExEnd = idx("recup_exercices_endurance");
    const iSerieHyp = idx("Nb_series_hypertrophie");
    const iRepHyp = idx("Nb_reps_hypertrophie");
    const iPctHyp = idx("Pourcentage_charge_1RM_hypertrophie");
    const iRecSerieHyp = idx("recup_series_hypertrophie");
    const iRecExHyp = idx("recup_exercices_hypertrophie");
    const iSerieFor = idx("Nb_series_force");
    const iRepFor = idx("Nb_reps_force");
    const iPctFor = idx("Pourcentage_charge_1RM_force");
    const iRecSerieFor = idx("recup_series_force");
    const iRecExFor = idx("recup_exercices_force");

    const exercises = [];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const name = String(safe(row, iNom) || "").trim();
      if (!name) continue;

      exercises.push({
        numeroExercice: String(safe(row, iNum) || "").trim(),
        nomExercice: name,
        description: String(safe(row, iDesc) || "").trim(),
        nbSeriesEndurance: String(safe(row, iSerieEnd) || "").trim(),
        nbRepsEndurance: String(safe(row, iRepEnd) || "").trim(),
        pct1rmEndurance: String(safe(row, iPctEnd) || "").trim(),
        recupSeriesEndurance: String(safe(row, iRecSerieEnd) || "").trim(),
        recupExercicesEndurance: String(safe(row, iRecExEnd) || "").trim(),
        nbSeriesHypertrophie: String(safe(row, iSerieHyp) || "").trim(),
        nbRepsHypertrophie: String(safe(row, iRepHyp) || "").trim(),
        pct1rmHypertrophie: String(safe(row, iPctHyp) || "").trim(),
        recupSeriesHypertrophie: String(safe(row, iRecSerieHyp) || "").trim(),
        recupExercicesHypertrophie: String(safe(row, iRecExHyp) || "").trim(),
        nbSeriesForce: String(safe(row, iSerieFor) || "").trim(),
        nbRepsForce: String(safe(row, iRepFor) || "").trim(),
        pct1rmForce: String(safe(row, iPctFor) || "").trim(),
        recupSeriesForce: String(safe(row, iRecSerieFor) || "").trim(),
        recupExercicesForce: String(safe(row, iRecExFor) || "").trim()
      });
    }

    return json_({ ok: true, exercises });
  }

  return text_("Unknown action");
}
