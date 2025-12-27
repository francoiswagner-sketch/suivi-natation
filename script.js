/* swim_app - script.js
   - Saisie sans clavier (menus déroulants)
   - Enregistrement local + synchronisation Google Sheets
   - Récupération des dernières séances (GET JSON)
   - KPIs + graphiques (canvas) avec toggle 7j / 30j / 365j
*/

document.addEventListener("DOMContentLoaded", () => {
  // ====== CONFIG ======
  // Mets ici l’URL /exec de ton déploiement Apps Script (avec ?token=...)
  const SYNC_ENDPOINT = "https://script.google.com/macros/s/AKfycbw3QkO0CLiFMw0G8-YTqEBO0NWoJOREhtL26CY6DUYPchs7lP-2jhAeK1a5PyPMOV298A/exec?token=ersteinaquaticclub2026";

  const STORAGE_SESSIONS_KEY = "swimSessions";
  const STORAGE_NAME_KEY = "swimmerName";
  const STORAGE_RANGE_KEY = "kpiRangeDays"; // 7 | 30 | 365
  const MAX_LOCAL_SESSIONS = 400;
  const MAX_LOCAL_DAYS = 365;

  // ====== DOM ======
  const form = document.getElementById("session-form");

  const accountAccessBtn = document.getElementById("account-access");
  const accountNameEl = document.getElementById("account-name");

  const sessionDateInput = document.getElementById("sessionDate");
  const timeSlotSelect = document.getElementById("timeSlot");

  const durationSelect = document.getElementById("duration");
  const distanceSelect = document.getElementById("distance");

  const rpeSelect = document.getElementById("rpe"); // Difficulté
  const performanceSelect = document.getElementById("performance");
  const engagementSelect = document.getElementById("engagement");
  const fatigueSelect = document.getElementById("fatigue");
  const commentsInput = document.getElementById("comments");

  const fetchLatestBtn = document.getElementById("fetch-latest");
  const kpisEl = document.getElementById("kpis");

  const sessionsTable = document.getElementById("sessions-table");
  const sessionsBody = sessionsTable ? sessionsTable.querySelector("tbody") : null;
  const noSessions = document.getElementById("no-sessions");
  const toggleHistoryBtn = document.getElementById("toggle-history");
  const historyPanel = document.getElementById("history-panel");

  const exportCsvBtn = document.getElementById("export-csv");
  const exportJsonBtn = document.getElementById("export-json");
  const clearDataBtn = document.getElementById("clear-data");

  const statusEl = document.getElementById("sync-status");

  const rangeBtns = Array.from(document.querySelectorAll(".range-btn"));

  const chartRpe = document.getElementById("chart-rpe");
  const chartPerformance = document.getElementById("chart-performance");
  const chartEngagement = document.getElementById("chart-engagement");
  const chartFatigue = document.getElementById("chart-fatigue");


  // ====== Coach DOM ======
  const coachAccessBtn = document.getElementById("coach-access");
  const coachExitBtn = document.getElementById("coach-exit");
  const coachSection = document.getElementById("coach-section");
  const swimmerSection = document.getElementById("sessions-section");

  const profileAccessBtn = document.getElementById("profile-access");
  const profileExitBtn = document.getElementById("profile-exit");
  const profileSection = document.getElementById("profile-section");

  const hallOfFameBtn = document.getElementById("hall-of-fame");
  const hallOfFameExitBtn = document.getElementById("hof-exit");
  const hallOfFameSection = document.getElementById("hof-section");
  const clubRecordsBtn = document.getElementById("club-records");
  const clubRecordsPanel = document.getElementById("club-records-panel");

  // Hall of Fame (classements)
  const hofRefreshBtn = document.getElementById("hof-refresh");
  const hofStatusEl = document.getElementById("hof-status");
  const hofRangeBtns = Array.from(document.querySelectorAll(".hof-range-btn"));
  const hofDistanceList = document.getElementById("hof-distance");
  const hofPerformanceList = document.getElementById("hof-performance");
  const hofEngagementList = document.getElementById("hof-engagement");

  const profileTabButtons = Array.from(document.querySelectorAll("#profile-section .tab-btn"));


  const coachAthleteSelect = document.getElementById("coach-athlete");
  const coachRefreshBtn = document.getElementById("coach-refresh");

  const coachKpisEl = document.getElementById("coach-kpis");

  const coachChartRpe = document.getElementById("coach-chart-rpe");
  const coachChartPerformance = document.getElementById("coach-chart-performance");
  const coachChartEngagement = document.getElementById("coach-chart-engagement");
  const coachChartFatigue = document.getElementById("coach-chart-fatigue");
  const coachToggleHistoryBtn = document.getElementById("coach-toggle-history");
  const coachHistoryWrap = document.getElementById("coach-history");
  const coachSessionsTable = document.getElementById("coach-sessions-table");
  const coachSessionsBody = coachSessionsTable ? coachSessionsTable.querySelector("tbody") : null;
  const coachNoSessions = document.getElementById("coach-no-sessions");



  // ====== STATE ======
  let sessions = [];
  let rangeDays = Number(localStorage.getItem(STORAGE_RANGE_KEY) || "7");
  if (![7, 30, 365].includes(rangeDays)) rangeDays = 7;

  let hofRangeDays = Number(localStorage.getItem("hofRangeDays") || "7");
  if (![7, 30, 365].includes(hofRangeDays)) hofRangeDays = 7;

  const COACH_PASSWORD = "David1989";
  let coachRangeDays = Number(localStorage.getItem("coachRangeDays") || "7");
  if (![7, 30, 365].includes(coachRangeDays)) coachRangeDays = 7;
  let coachSessions = [];

  
  // ====== CHART ZONES (hoisted) ======
  const zonesHighBad = [
    { from: 1, to: 4, color: "rgba(34,197,94,1)", alpha: 0.12 },   // vert
    { from: 4, to: 7, color: "rgba(234,179,8,1)", alpha: 0.12 },   // orange
    { from: 7, to: 10, color: "rgba(239,68,68,1)", alpha: 0.12 },  // rouge
  ];

  const zonesHighGood = [
    { from: 1, to: 4, color: "rgba(239,68,68,1)", alpha: 0.12 },   // rouge
    { from: 4, to: 7, color: "rgba(234,179,8,1)", alpha: 0.12 },   // orange
    { from: 7, to: 10, color: "rgba(34,197,94,1)", alpha: 0.12 },  // vert
  ];

// ====== Helpers ======

  function normalizeName(str) {
    return (str || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function setStatus(message, type = "") {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.remove("success", "error", "info");
    if (type) statusEl.classList.add(type);
  }

  
  function setHofStatus(message, type = "") {
    if (!hofStatusEl) return;
    hofStatusEl.textContent = message || "";
    hofStatusEl.classList.remove("success", "error", "info");
    if (type) hofStatusEl.classList.add(type);
  }

  function setActiveRangeButtons(buttons, active) {
    buttons.forEach((b) => b.classList.toggle("active", String(b.dataset.range) === String(active)));
  }

  function renderHofList(listEl, rows, formatter) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!rows.length) {
      const li = document.createElement("li");
      li.textContent = "—";
      listEl.appendChild(li);
      return;
    }

    const plural = (n) => (n === 1 ? "séance" : "séances");

    rows.forEach((r, idx) => {
      const li = document.createElement("li");

      const rank = idx + 1;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";

      const left = document.createElement("span");
      left.className = "hof-name";

      // Top 3 : médaille. Ensuite : numérotation classique.
      left.textContent = medal
        ? `${medal} ${r.athleteName}`
        : `${rank}. ${r.athleteName}`;

      const right = document.createElement("span");
      right.className = "hof-metric";

      const base = formatter(r);
      const sc = Number(r.sessionsCount || 0);
      const sessionsPart = sc ? ` · ${sc} ${plural(sc)}` : "";
      right.textContent = `${base}${sessionsPart}`;

      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    });
  }

  async function fetchHallOfFame(days) {
    if (!SYNC_ENDPOINT) throw new Error("Endpoint non configuré");
    const url = new URL(SYNC_ENDPOINT);
    url.searchParams.set("action", "hall");
    url.searchParams.set("days", String(days));

    setHofStatus("Chargement…", "info");
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);

    let data;
    try { data = JSON.parse(txt); } catch { throw new Error("Réponse non JSON : " + txt.slice(0, 120)); }
    if (!data || data.ok !== true || !Array.isArray(data.athletes)) {
      throw new Error(data && data.error ? data.error : "Format inattendu");
    }

    const athletes = data.athletes;

    const byDistance = [...athletes].sort((a, b) => (b.distanceTotal || 0) - (a.distanceTotal || 0));
    const byPerf = [...athletes].filter(a => a.performanceAvg != null)
      .sort((a, b) => (b.performanceAvg || 0) - (a.performanceAvg || 0));
    const byEng = [...athletes].filter(a => a.engagementAvg != null)
      .sort((a, b) => (b.engagementAvg || 0) - (a.engagementAvg || 0));

    renderHofList(hofDistanceList, byDistance, (r) => `${((r.distanceTotal || 0) / 1000).toFixed(1)} km`);
    renderHofList(hofPerformanceList, byPerf, (r) => (r.performanceAvg != null ? r.performanceAvg.toFixed(2) : "—"));
    renderHofList(hofEngagementList, byEng, (r) => (r.engagementAvg != null ? r.engagementAvg.toFixed(2) : "—"));

    setHofStatus(`✅ Classements mis à jour (${days} jours)`, "success");
  }
function safeInt(v) {
    if (v === "" || v === null || v === undefined) return NaN;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function todayISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Accepte "YYYY-MM-DD", "DD/MM/YYYY" et formats Date.parse() (ex: "Thu Dec 25 2025 ...")
  function parseAnyDateToDate(value) {
    const s = String(value || "").trim();
    if (!s) return new Date(NaN);

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
      return new Date(y, (m || 1) - 1, d || 1);
    }

    // DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split("/").map((x) => parseInt(x, 10));
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    }

    // DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split("-").map((x) => parseInt(x, 10));
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    }

    // Autres formats (Date.parse)
    const dt = new Date(s);
    return dt;
  }

  function toISODateString(value) {
    // Accepte Date ou string
    const dt = (value instanceof Date) ? value : parseAnyDateToDate(value);
    if (!dt || !Number.isFinite(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }


  function formatDateDisplay(value) {
    // Affichage local: DD-MM-YYYY
    const iso = toISODateString(value);
    if (!iso) return String(value || "");
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  }

  
function formatMinutesAsHours(totalMinutes) {
  const mins = Number(totalMinutes);
  if (!Number.isFinite(mins) || mins <= 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins - h * 60);
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function computeLoad(duration, rpe) {
    const d = Number(duration);
    const r = Number(rpe);
    if (!Number.isFinite(d) || !Number.isFinite(r)) return 0;
    return d * r;
  }

  function loadSessions() {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      sessions = Array.isArray(parsed) ? trimSessions(parsed) : [];
    } catch {
      sessions = [];
    }
  }

  function saveSessions() {
    sessions = trimSessions(sessions);
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  }

  function applyStoredNameUI() {
    const stored = localStorage.getItem(STORAGE_NAME_KEY);
    if (stored) {
      if (accountNameEl) {
        accountNameEl.textContent = stored;
        accountNameEl.classList.remove("hidden");
      }
    } else {
      if (accountNameEl) {
        accountNameEl.textContent = "";
        accountNameEl.classList.add("hidden");
      }
    }
  }



  // ====== Coach view helpers ======
  function setAppView(view) {
    const isAthlete = view === "athlete";
    coachSection?.classList.toggle("hidden", view !== "coach");
    profileSection?.classList.toggle("hidden", view !== "profile");
    hallOfFameSection?.classList.toggle("hidden", view !== "hof");

    form?.classList.toggle("hidden", !isAthlete);
    swimmerSection?.classList.toggle("hidden", !isAthlete);
  }

  function setCoachMode(enabled) {
    setAppView(enabled ? "coach" : "athlete");
  }

  function ensureCoachOptionsFromSessions() {
    if (!coachAthleteSelect) return;
    const names = Array.from(new Set(sessions.map((s) => (s.athleteName || "").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'fr'));
    const current = coachAthleteSelect.value;
    coachAthleteSelect.innerHTML = '<option value="" selected>— Sélectionner un nageur —</option>' + names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    if (current && names.includes(current)) coachAthleteSelect.value = current;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  async function fetchSessionsFromSheetsFor(athleteName, limit = 200) {
    const sep = SYNC_ENDPOINT.includes("?") ? "&" : "?";
    const url =
      `${SYNC_ENDPOINT}${sep}action=get&athleteName=${encodeURIComponent(athleteName)}&limit=${encodeURIComponent(String(limit))}`;

    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);

    let data;
    try { data = JSON.parse(txt); } catch { throw new Error(`Réponse non JSON : ${txt.slice(0, 200)}`); }
    if (!data || data.ok !== true || !Array.isArray(data.sessions)) throw new Error(data?.error || "Format inattendu");

    // Normalisation minimale
    return data.sessions.map((s) => {
      const athleteName = (s.athleteName || "").toString().trim();
      const sessionDateISO = toISODateString(s.sessionDate);
      return {
        athleteName,
        // On conserve la date normalisée ISO pour les filtres/graphes
        sessionDate: sessionDateISO,
        sessionDateISO,
        timeSlot: (s.timeSlot || "").toString().trim(),
        duration: safeInt(s.duration),
        distance: (s.distance === "" || s.distance === null || s.distance === undefined) ? "" : safeInt(s.distance),
        rpe: safeInt(s.rpe),
        performance: safeInt(s.performance),
        engagement: safeInt(s.engagement),
        fatigue: safeInt(s.fatigue),
        comments: s.comments || "",
      };
    }).filter((s) => s.athleteName && s.sessionDate && !Number.isNaN(s.duration) && !Number.isNaN(s.rpe));
  }

  function renderCoachKpisAndCharts() {
    if (!coachKpisEl) return;
    const athlete = coachAthleteSelect?.value || "";
    if (!athlete) {
      coachKpisEl.innerHTML = '<div class="info">Sélectionnez un nageur pour afficher les KPIs.</div>';
      drawLineChart(coachChartRpe, [], { title: "Difficulté" });
      drawLineChart(coachChartPerformance, [], { title: "Performance" });
      drawLineChart(coachChartEngagement, [], { title: "Engagement" });
      drawLineChart(coachChartFatigue, [], { title: "Fatigue" });
      return;
    }

    const athleteKey = normalizeName(athlete);
    const mine = coachSessions.filter((s) => normalizeName(s.athleteName) === athleteKey);
    const inRange = filterByDays(mine, coachRangeDays);

    const sessionsRange = inRange.length;
    const avgRpe = avg(inRange, "rpe");
    const avgPerf = avg(inRange, "performance");
    const avgEng = avg(inRange, "engagement");
    const avgFat = avg(inRange, "fatigue");
    const totalMin = sum(inRange, "duration");
    const totalLoad = inRange.reduce((acc, s) => acc + computeLoad(s.duration, s.rpe), 0);
    const dist = sum(inRange, "distance");
    const distLabel = dist ? `${Math.round(dist / 100) / 10} km` : "—";

    const cards = [
      { label: `Séances (${coachRangeDays}j)`, value: sessionsRange },
      { label: `Difficulté moy. (${coachRangeDays}j)`, value: avgRpe != null ? avgRpe.toFixed(1) : "—" },
      { label: `Performance moy. (${coachRangeDays}j)`, value: avgPerf != null ? avgPerf.toFixed(1) : "—" },
      { label: `Engagement moy. (${coachRangeDays}j)`, value: avgEng != null ? avgEng.toFixed(1) : "—" },
      { label: `Fatigue moy. (${coachRangeDays}j)`, value: avgFat != null ? avgFat.toFixed(1) : "—" },
      { label: `Durée totale (${coachRangeDays}j)`, value: `${formatMinutesAsHours(totalMin)}` },
      { label: `Charge totale (${coachRangeDays}j)`, value: Math.round(totalLoad) },
      { label: `Kilométrage total (${coachRangeDays}j)`, value: distLabel },
    ];

    coachKpisEl.innerHTML = cards
      .map((c) => `<div class="kpi"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`)
      .join("");

    const makeRawPoints = (list, key) => {
      return (list || [])
        .map(s => {
          const dt = parseAnyDateToDate(s.sessionDateISO || s.sessionDate);
          const y = Number(s && s[key]);
          if (!dt || !Number.isFinite(dt.getTime()) || !Number.isFinite(y)) return null;
          return { date: toISODateString(dt), x: dt, y };
        })
        .filter(Boolean)
        .sort((a,b)=>a.x-b.x);
    };

    const buildPoints = (key) => {
      // 1) essai identique côté nageur : moyenne journalière
      const daily = groupDailyAverage(inRange, key);
      if (daily && daily.length) return daily;
      // 2) fallback : points par séance (si un problème de regroupement date survient)
      const rawPts = makeRawPoints(inRange, key);
      return rawPts || [];
    };

    const rpePts2 = buildPoints('rpe');
    const perfPts2 = buildPoints('performance');
    const engPts2 = buildPoints('engagement');
    const fatPts2 = buildPoints('fatigue');

    drawLineChart(coachChartRpe, rpePts2, { title: `Difficulté — ${athlete} (${coachRangeDays}j)`, zones: zonesHighBad });
    drawLineChart(coachChartPerformance, perfPts2, { title: `Performance — ${athlete} (${coachRangeDays}j)`, zones: zonesHighGood });
    drawLineChart(coachChartEngagement, engPts2, { title: `Engagement — ${athlete} (${coachRangeDays}j)`, zones: zonesHighGood });
    drawLineChart(coachChartFatigue, fatPts2, { title: `Fatigue — ${athlete} (${coachRangeDays}j)`, zones: zonesHighBad });
  }
  function ensureDefaults() {
    if (sessionDateInput && !sessionDateInput.value) sessionDateInput.value = todayISODate();
    if (timeSlotSelect && !timeSlotSelect.value) timeSlotSelect.value = "matin";
  }

  function populateDistanceOptions() {
    if (!distanceSelect) return;
    if (distanceSelect.querySelector("option[value='2000']")) return;

    // Option vide => kilométrage facultatif
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— (facultatif)";
    empty.selected = true;
    distanceSelect.appendChild(empty);

    for (let m = 2000; m <= 7000; m += 100) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = `${m} m`;
      distanceSelect.appendChild(opt);
    }
  }

  function sessionKey(s) {
    return [
      s.athleteName || "",
      s.sessionDate || "",
      s.timeSlot || "",
      String(s.duration ?? ""),
      String(s.distance ?? ""),
      String(s.rpe ?? ""),
      String(s.performance ?? ""),
      String(s.engagement ?? ""),
      String(s.fatigue ?? ""),
    ].join("|");
  }

  function sortSessionsDesc(list) {
    return list.sort((a, b) => {
      const da = parseAnyDateToDate(a.sessionDate).getTime();
      const db = parseAnyDateToDate(b.sessionDate).getTime();
      if (da !== db) return db - da;
      // soir après matin
      return (b.timeSlot === "soir" ? 1 : 0) - (a.timeSlot === "soir" ? 1 : 0);
    });
  }

  function trimSessions(list) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - MAX_LOCAL_DAYS);

    const filtered = (list || []).filter((s) => {
      const dt = parseAnyDateToDate(s.sessionDate);
      return Number.isFinite(dt.getTime()) && dt >= from;
    });

    return sortSessionsDesc(filtered).slice(0, MAX_LOCAL_SESSIONS);
  }

  function getMine() {
    const storedName = localStorage.getItem(STORAGE_NAME_KEY) || "";
    return storedName ? sessions.filter((s) => s.athleteName === storedName) : sessions.slice();
  }

  function filterByDays(list, days) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    return list.filter((s) => {
      const dt = parseAnyDateToDate(s.sessionDate);
      return Number.isFinite(dt.getTime()) && dt >= from;
    });
  }

  function updateRangeButtons() {
    if (!rangeBtns.length) return;
    rangeBtns.forEach((b) => {
      const scope = b.dataset.scope || "swimmer";
      const cur = scope === "coach" ? coachRangeDays : rangeDays;
      b.classList.toggle("active", Number(b.dataset.range) === cur);
      b.setAttribute("aria-pressed", Number(b.dataset.range) === cur ? "true" : "false");
    });
  }

  // ====== Table ======
  function updateTable() {
    if (!sessionsTable || !sessionsBody || !noSessions) return;
    sessionsBody.innerHTML = "";

    const mine = getMine();

    const MAX_ROWS = 30;
    const displayList = mine.slice(0, MAX_ROWS);

    if (!mine.length) {
      sessionsTable.classList.add("hidden");
      noSessions.classList.remove("hidden");
      return;
    }

    sessionsTable.classList.remove("hidden");
    noSessions.classList.add("hidden");

    const labels = [
      "Nom",
      "Date",
      "Créneau",
      "Durée (min)",
      "Km",
      "Difficulté",
      "Performance",
      "Engagement",
      "Fatigue",
      "Charge",
      "Commentaires",
    ];

    displayList.forEach((s) => {
      const tr = document.createElement("tr");

      function td(val, label) {
        const cell = document.createElement("td");
        cell.textContent = val == null || val === "" ? "" : String(val);
        cell.setAttribute("data-label", label);
        return cell;
      }

      tr.appendChild(td(s.athleteName, labels[0]));
      tr.appendChild(td(formatDateDisplay(s.sessionDate), labels[1]));
      tr.appendChild(td(s.timeSlot, labels[2]));
      tr.appendChild(td(s.duration, labels[3]));
      tr.appendChild(td(s.distance ? `${s.distance} m` : "", labels[4]));
      tr.appendChild(td(s.rpe, labels[5]));
      tr.appendChild(td(s.performance, labels[6]));
      tr.appendChild(td(s.engagement, labels[7]));
      tr.appendChild(td(s.fatigue, labels[8]));
      tr.appendChild(td(computeLoad(s.duration, s.rpe), labels[9]));
      tr.appendChild(td(s.comments || "", labels[10]));

      sessionsBody.appendChild(tr);
    });
  }

  function getCoachSelectedSessions() {
    const athlete = coachAthleteSelect?.value || "";
    if (!athlete) return [];
    const key = normalizeName(athlete);
    return coachSessions.filter((s) => normalizeName(s.athleteName) === key);
  }

  function updateCoachHistoryTable() {
    if (!coachHistoryWrap || !coachSessionsTable || !coachSessionsBody || !coachNoSessions) return;

    const list = sortSessionsDesc(getCoachSelectedSessions()).slice(0, 30);

    coachSessionsBody.innerHTML = "";

    if (!list.length) {
      coachSessionsTable.classList.add("hidden");
      coachNoSessions.classList.remove("hidden");
      coachNoSessions.textContent = "Aucune séance pour ce nageur.";
      return;
    }

    coachNoSessions.classList.add("hidden");
    coachSessionsTable.classList.remove("hidden");

    list.forEach((s) => {
      const tr = document.createElement("tr");

      function td(val) {
        const cell = document.createElement("td");
        cell.textContent = val == null || val === "" ? "" : String(val);
        return cell;
      }

      tr.appendChild(td(formatDateDisplay(s.sessionDate)));
      tr.appendChild(td(s.timeSlot || ""));
      tr.appendChild(td(s.duration ? `${s.duration} min` : ""));
      tr.appendChild(td(s.distance ? `${s.distance} m` : ""));
      tr.appendChild(td(s.rpe));
      tr.appendChild(td(s.performance));
      tr.appendChild(td(s.engagement));
      tr.appendChild(td(s.fatigue));
      tr.appendChild(td(Math.round(computeLoad(s.duration, s.rpe))));
      tr.appendChild(td((s.comments || "").toString()));

      coachSessionsBody.appendChild(tr);
    });
  }

  // ====== KPIs ======
  function avg(list, key) {
    if (!list.length) return null;
    const vals = list.map((s) => Number(s[key])).filter((v) => Number.isFinite(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function sum(list, key) {
    return list
      .map((s) => Number(s[key]))
      .filter((v) => Number.isFinite(v))
      .reduce((a, b) => a + b, 0);
  }

  function renderKpis() {
    if (!kpisEl) return;

    const mine = getMine();

    if (!mine.length) {
      kpisEl.innerHTML = "";
      return;
    }

    const inRange = filterByDays(mine, rangeDays);
    
    const sessionsRange = inRange.length;
    const avgRpe = avg(inRange, "rpe");
    const avgPerf = avg(inRange, "performance");
    const avgEng = avg(inRange, "engagement");
    const avgFat = avg(inRange, "fatigue");

    const totalMin = sum(inRange, "duration");
    const totalLoad = inRange.reduce((acc, s) => acc + computeLoad(s.duration, s.rpe), 0);

    const dist = sum(inRange, "distance"); // en mètres
    const distLabel = dist ? `${Math.round(dist / 100) / 10} km` : "—";

    const cards = [
      { label: `Séances (${rangeDays}j)`, value: sessionsRange },
      { label: `Difficulté moy. (${rangeDays}j)`, value: avgRpe != null ? avgRpe.toFixed(1) : "—" },
      { label: `Performance moy. (${rangeDays}j)`, value: avgPerf != null ? avgPerf.toFixed(1) : "—" },
      { label: `Engagement moy. (${rangeDays}j)`, value: avgEng != null ? avgEng.toFixed(1) : "—" },
      { label: `Fatigue moy. (${rangeDays}j)`, value: avgFat != null ? avgFat.toFixed(1) : "—" },
      { label: `Durée totale (${rangeDays}j)`, value: `${formatMinutesAsHours(totalMin)}` },
      { label: `Charge totale (${rangeDays}j)`, value: Math.round(totalLoad) },
      { label: `Kilométrage total (${rangeDays}j)`, value: distLabel },
    ];

    kpisEl.innerHTML = cards
      .map(
        (c) =>
          `<div class="kpi"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`
      )
      .join("");
  }

  // ====== Charts (canvas) ======
  function groupDailyAverage(list, key) {
    // key: rpe/performance/engagement/fatigue
    // Output: [{date: 'YYYY-MM-DD', x: Date, y: number}]
    const map = new Map(); // isoDate -> {sum, count}

    const toDayKey = (s) => {
      const raw = (s && (s.sessionDateISO || s.sessionDate)) ? String(s.sessionDateISO || s.sessionDate).trim() : "";
      if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      const dt = parseAnyDateToDate(raw);
      if (dt && Number.isFinite(dt.getTime())) return toISODateString(dt);
      return "";
    };

    (list || []).forEach((s) => {
      const iso = toDayKey(s);
      if (!iso) return;
      const v = Number(s && s[key]);
      if (!Number.isFinite(v)) return;

      const cur = map.get(iso) || { sum: 0, count: 0 };
      cur.sum += v;
      cur.count += 1;
      map.set(iso, cur);
    });

    const pts = Array.from(map.entries())
      .map(([iso, agg]) => ({ date: iso, x: parseAnyDateToDate(iso), y: agg.sum / agg.count }))
      .filter((p) => p.x && Number.isFinite(p.x.getTime()) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);

    return pts;
  }


  function resizeCanvasForHiDpi(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // IMPORTANT: utiliser rect.height (CSS) comme référence, sinon le canvas grossit à chaque redraw
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return { dpr, width, height };
  }

  function clearCanvas(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  
function drawLineChart(canvas, points, opts) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { dpr, width, height } = resizeCanvasForHiDpi(canvas);
    const w = width / dpr;
    const h = height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const zones = (opts && opts.zones) ? opts.zones : null;

    // Drawing area
    const padL = Math.round(w * 0.08);
    const padR = Math.round(w * 0.04);
    const padT = Math.round(h * 0.14);
    const padB = Math.round(h * 0.18);
    const plotX = padL;
    const plotY = padT;
    const plotW = Math.max(1, w - padL - padR);
    const plotH = Math.max(1, h - padT - padB);

    // Axis range (always 1..10 for our indicators)
    const yMin = 1;
    const yMax = 10;

    // Background zones (always draw for readability)
    if (zones && Array.isArray(zones)) {
      zones.forEach(z => {
        const y0 = plotY + ((yMax - z.to) / (yMax - yMin)) * plotH;
        const y1 = plotY + ((yMax - z.from) / (yMax - yMin)) * plotH;
        ctx.fillStyle = z.color;
        ctx.fillRect(plotX, Math.min(y0, y1), plotW, Math.abs(y1 - y0));
      });
    }

    // Grid lines (1..10)
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let y = 1; y <= 10; y += 1) {
      const py = plotY + ((yMax - y) / (yMax - yMin)) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotX, py);
      ctx.lineTo(plotX + plotW, py);
      ctx.stroke();
    }

    // Title
    if (opts && opts.title) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.title, plotX, Math.max(10, padT / 2));
    }

    // No data / single point handling
    if (!points || points.length === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Aucune donnée sur la période", plotX + plotW / 2, plotY + plotH / 2);
      return;
    }

    // Build x scale
    const xs = points.map(p => p.x instanceof Date ? p.x.getTime() : new Date(p.x).getTime()).filter(t => Number.isFinite(t));
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const sameX = xMin === xMax;

    const xToPx = (t) => {
      if (sameX) return plotX + plotW / 2;
      return plotX + ((t - xMin) / (xMax - xMin)) * plotW;
    };
    const yToPx = (v) => plotY + ((yMax - v) / (yMax - yMin)) * plotH;

    // If only one point: draw a dot + value
    if (points.length === 1) {
      const p = points[0];
      const t = (p.x instanceof Date) ? p.x.getTime() : new Date(p.x).getTime();
      const x = xToPx(t);
      const y = yToPx(p.y);

      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(Math.round(p.y * 10) / 10), x, y - 6);
      return;
    }

    // Line
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const t = (p.x instanceof Date) ? p.x.getTime() : new Date(p.x).getTime();
      const x = xToPx(t);
      const y = yToPx(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    ctx.fillStyle = "rgba(0,0,0,0.95)";
    points.forEach((p) => {
      const t = (p.x instanceof Date) ? p.x.getTime() : new Date(p.x).getTime();
      const x = xToPx(t);
      const y = yToPx(p.y);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }


  function renderCharts() {
    const mine = getMine();

    const inRange = filterByDays(mine, rangeDays);

    const rpePts = groupDailyAverage(inRange, "rpe");
    const perfPts = groupDailyAverage(inRange, "performance");
    const engPts = groupDailyAverage(inRange, "engagement");
    const fatPts = groupDailyAverage(inRange, "fatigue");

    const buildRawPoints = (list, key) => {
      return (list || [])
        .map((s) => {
          const d = parseAnyDateToDate(s.sessionDateISO || s.sessionDate);
          const y = Number(s && s[key]);
          if (!d || !Number.isFinite(d.getTime()) || !Number.isFinite(y)) return null;
          return { date: toISODateString(d), x: d, y };
        })
        .filter(Boolean)
        .sort((a, b) => a.x - b.x);
    };

    // 1) Regroupement journalier (comme côté nageur)
    // 2) Si (pour une raison quelconque) ça donne 0 point alors qu'il y a des séances,
    //    on tombe en fallback sur les points « par séance » pour ne jamais afficher un graphe vide.
    const ensurePoints = (pts, key) => {
      if (pts && pts.length) return pts;
      const daily = groupDailyAverage(inRange, key);
      if (daily && daily.length) return daily;
      return buildRawPoints(inRange, key);
    };

    const rpePts2 = ensurePoints(rpePts, "rpe");
    const perfPts2 = ensurePoints(perfPts, "performance");
    const engPts2 = ensurePoints(engPts, "engagement");
    const fatPts2 = ensurePoints(fatPts, "fatigue");


    drawLineChart(chartRpe, rpePts, { title: `Difficulté (${rangeDays}j)`, zones: zonesHighBad });
    drawLineChart(chartPerformance, perfPts, { title: `Performance (${rangeDays}j)`, zones: zonesHighGood });
    drawLineChart(chartEngagement, engPts, { title: `Engagement (${rangeDays}j)`, zones: zonesHighGood });
    drawLineChart(chartFatigue, fatPts, { title: `Fatigue (${rangeDays}j)`, zones: zonesHighBad });
  }

  // ====== Sync / Fetch ======
  async function syncSession(session) {
    const res = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...session, userAgent: navigator.userAgent }),
    });
    const txt = (await res.text()).trim();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);
    if (!txt.startsWith("OK")) throw new Error(txt || "Réponse inattendue");
  }

  async function fetchLatestSessions() {
    const storedName = localStorage.getItem(STORAGE_NAME_KEY);
    if (!storedName) {
      setStatus("Veuillez vous connecter pour pouvoir récupérer vos séances.", "error");
      return;
    }
    if (!SYNC_ENDPOINT) {
      setStatus("Endpoint de synchronisation non configuré.", "error");
      return;
    }

    // Construction robuste (évite soucis URL()/searchParams + redirects)
    const sep = SYNC_ENDPOINT.includes("?") ? "&" : "?";
    const url =
      `${SYNC_ENDPOINT}${sep}action=get` +
      `&athleteName=${encodeURIComponent(storedName)}` +
      `&limit=120`;

    setStatus("Récupération des séances…", "info");

    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const txt = await res.text();

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);

    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      throw new Error(`Réponse non JSON : ${txt.slice(0, 200)}`);
    }

    if (!data || data.ok !== true || !Array.isArray(data.sessions)) {
      throw new Error(data?.error || "Format inattendu (sessions manquant)");
    }

    const fetched = data.sessions
      .map((s) => ({
        athleteName: (s.athleteName || "").toString(),
        // Normalise la date renvoyée par Sheets (peut être "25/12/2025" ou une date longue)
        sessionDate: toISODateString(s.sessionDate),
        timeSlot: (s.timeSlot || "").toString(),
        duration: safeInt(s.duration),
        distance:
          s.distance === "" || s.distance === null || s.distance === undefined
            ? ""
            : safeInt(s.distance),
        rpe: safeInt(s.rpe),
        performance: safeInt(s.performance),
        engagement: safeInt(s.engagement),
        fatigue: safeInt(s.fatigue),
        comments: (s.comments || "").toString(),
      }))
      .filter((s) => s.athleteName && s.sessionDate && !Number.isNaN(s.duration) && !Number.isNaN(s.rpe));

    // Merge + dedupe
    const byKey = new Map();
    [...sessions, ...fetched].forEach((s) => byKey.set(sessionKey(s), s));
    sessions = trimSessions([...byKey.values()]);
    saveSessions();

    updateRangeButtons();
    updateTable();
    renderKpis();
    renderCharts();

    setStatus(`✅ ${fetched.length} séance(s) récupérée(s).`, "success");
  }

  // ====== Events ======
  // Empêche les soumissions involontaires via la touche Entrée (sauf dans le champ commentaires).
  form?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
      if (tag !== "TEXTAREA") e.preventDefault();
    }
  });
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    // Sur mobile, un "Entrée" ou certaines actions peuvent déclencher un submit implicite.
    // On n'enregistre que si l'utilisateur a bien cliqué sur le bouton "Enregistrer la séance".
    const submitter = e.submitter;
    if (!submitter || submitter.id !== "submit-btn") {
      setStatus("Appuyez sur « Enregistrer la séance » pour valider.", "info");
      return;
    }

    const storedName = localStorage.getItem(STORAGE_NAME_KEY);
    const athleteName = (storedName || "").trim();

    const sessionDate = sessionDateInput?.value || "";
    const sessionDateISO = toISODateString(sessionDate);
    const timeSlot = timeSlotSelect?.value || "";

    const duration = safeInt(durationSelect?.value);
    const distance = distanceSelect?.value ? safeInt(distanceSelect.value) : "";

    const rpe = safeInt(rpeSelect?.value);
    const performance = safeInt(performanceSelect?.value);
    const engagement = safeInt(engagementSelect?.value);
    const fatigue = safeInt(fatigueSelect?.value);
    const comments = (commentsInput?.value || "").trim();

    if (!athleteName) return setStatus("Veuillez vous connecter pour pouvoir ajouter une séance.", "error");
    if (!sessionDateISO) return setStatus("Merci de sélectionner une date.", "error");
    if (!timeSlot) return setStatus("Merci de choisir Matin ou Soir.", "error");
    if ([duration, rpe, performance, engagement, fatigue].some((x) => Number.isNaN(x))) {
      return setStatus("Merci de sélectionner toutes les valeurs.", "error");
    }

    const session = {
      athleteName,
      sessionDate: sessionDateISO,
      timeSlot,
      duration,
      distance: distance || "",
      rpe,
      performance,
      engagement,
      fatigue,
      comments,
    };

    sessions.unshift(session);
    sessions = trimSessions(sessions);
    saveSessions();

    updateRangeButtons();
    updateTable();
    renderKpis();
    renderCharts();

    setStatus("Envoi au coach…", "info");
    try {
      await syncSession(session);
      setStatus("✅ Séance enregistrée et envoyée au coach.", "success");
    } catch (err) {
      console.error(err);
      setStatus(
        "⚠️ Séance enregistrée sur le téléphone, mais envoi au coach impossible (" +
          (err?.message || "réseau/token/droits") +
          ").",
        "error"
      );
    }

    // Reset partiel
    if (commentsInput) commentsInput.value = "";
    if (distanceSelect) distanceSelect.value = "";
    ensureDefaults();
  });

  
  // Historique (table) masqué par défaut pour éviter d'afficher tous les imports sous les KPIs
  if (toggleHistoryBtn && historyPanel) {
    const syncHistoryButtonLabel = () => {
      const open = !historyPanel.classList.contains("hidden");
      toggleHistoryBtn.textContent = open ? "Masquer l’historique" : "Afficher l’historique";
    };
    toggleHistoryBtn.addEventListener("click", () => {
      historyPanel.classList.toggle("hidden");
      syncHistoryButtonLabel();
      if (!historyPanel.classList.contains("hidden")) {
        updateTable();
      }
    });
    syncHistoryButtonLabel();
  }


  // ====== Coach access ======
  function requestCoachAccess() {
    const ok = prompt("Mot de passe coach :");
    if (ok === null) return;
    if (ok === COACH_PASSWORD) {
      sessionStorage.setItem("coachAccess", "1");
      setCoachMode(true);
      ensureCoachOptionsFromSessions();
      updateRangeButtons();
      setStatus("", "");
      // si un nageur est déjà sélectionné, render
      renderCoachKpisAndCharts();
    } else {
      alert("Mot de passe incorrect.");
    }
  }

  coachAccessBtn?.addEventListener("click", () => {
    requestCoachAccess();
  });

  coachExitBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("coachAccess");
    setCoachMode(false);
    updateRangeButtons();
    renderKpis();
    renderCharts();
  });

  // ====== Profile + Hall of Fame views ======
  profileAccessBtn?.addEventListener("click", () => {
    setStatus("", "");
    setAppView("profile");
  });

  profileExitBtn?.addEventListener("click", () => {
    setAppView("athlete");
  });

  hallOfFameBtn?.addEventListener("click", async () => {
    setStatus("", "");
    setAppView("hof");
    setActiveRangeButtons(hofRangeBtns, hofRangeDays);
    try {
      await fetchHallOfFame(hofRangeDays);
    } catch (err) {
      console.error(err);
      setHofStatus("⚠️ Impossible de charger : " + (err?.message || "erreur"), "error");
    }
  });

  // Hall of Fame interactions
  hofRangeBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const days = Number(btn.dataset.range || "7");
      if (![7, 30, 365].includes(days)) return;
      hofRangeDays = days;
      localStorage.setItem("hofRangeDays", String(hofRangeDays));
      setActiveRangeButtons(hofRangeBtns, hofRangeDays);
      try {
        await fetchHallOfFame(hofRangeDays);
      } catch (err) {
        console.error(err);
        setHofStatus("⚠️ Impossible de charger : " + (err?.message || "erreur"), "error");
      }
    });
  });

  hofRefreshBtn?.addEventListener("click", async () => {
    setActiveRangeButtons(hofRangeBtns, hofRangeDays);
    try {
      await fetchHallOfFame(hofRangeDays);
    } catch (err) {
      console.error(err);
      setHofStatus("⚠️ Impossible de charger : " + (err?.message || "erreur"), "error");
    }
  });


  hallOfFameExitBtn?.addEventListener("click", () => {
    setAppView("athlete");
  });

  clubRecordsBtn?.addEventListener("click", () => {
    clubRecordsPanel?.classList.toggle("hidden");
  });

  profileTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      profileTabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.getAttribute("data-tab");
      document.getElementById("tab-strength")?.classList.toggle("hidden", tab !== "strength");
      document.getElementById("tab-performances")?.classList.toggle("hidden", tab !== "performances");
    });
  });


  coachAthleteSelect?.addEventListener("change", () => {
    renderCoachKpisAndCharts();
    updateCoachHistoryTable();
    requestAnimationFrame(() => renderCoachKpisAndCharts());
    setTimeout(() => renderCoachKpisAndCharts(), 50);
  });

  coachRefreshBtn?.addEventListener("click", async () => {
    const athlete = coachAthleteSelect?.value || "";
    if (!athlete) {
      alert("Sélectionnez un nageur.");
      return;
    }
    try {
      setStatus("Récupération coach…", "info");
      coachSessions = await fetchSessionsFromSheetsFor(athlete, 200);

      // Rendu coach (mêmes graphes que côté nageur)
      renderCoachKpisAndCharts();
      updateCoachHistoryTable();

      // Laisse le navigateur calculer les tailles de canvas
      requestAnimationFrame(() => {
        renderCoachKpisAndCharts();
        requestAnimationFrame(() => renderCoachKpisAndCharts());
      });
      setTimeout(() => renderCoachKpisAndCharts(), 80);

      setStatus("✅ Données coach mises à jour.", "success");
    } catch (e) {
      console.error(e);
      setStatus("⚠️ Impossible de récupérer (coach) : " + (e?.message || "erreur"), "error");
    }
  });

  accountAccessBtn?.addEventListener("click", () => {
    const name = prompt("Nom du nageur :");
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setStatus("Nom invalide.", "error");
      return;
    }
    localStorage.setItem(STORAGE_NAME_KEY, trimmed);
    applyStoredNameUI();
    setStatus(`Connecté en tant que ${trimmed}.`, "success");
    updateTable();
    renderKpis();
    renderCharts();
  });

  fetchLatestBtn?.addEventListener("click", async () => {
    try {
      await fetchLatestSessions();
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Impossible de récupérer : " + (err?.message || "erreur"), "error");
    }
  });

  rangeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const days = Number(btn.dataset.range);
      if (![7, 30, 365].includes(days)) return;
      const scope = btn.dataset.scope || "swimmer";
      if (scope === "coach") {
        coachRangeDays = days;
        localStorage.setItem("coachRangeDays", String(coachRangeDays));
        updateRangeButtons();
        renderCoachKpisAndCharts();
      } else {
        rangeDays = days;
        localStorage.setItem(STORAGE_RANGE_KEY, String(rangeDays));
        updateRangeButtons();
        renderKpis();
        renderCharts();
      }
    });
  });exportCsvBtn?.addEventListener("click", () => {
    const mine = getMine();

    if (!mine.length) return alert("Aucune séance à exporter.");

    const headers = [
      "Nom",
      "Date",
      "Créneau",
      "Durée (min)",
      "Distance (m)",
      "Difficulté",
      "Performance",
      "Engagement",
      "Fatigue",
      "Charge",
      "Commentaires",
    ];

    const rows = mine.map((s) => [
      s.athleteName,
      s.sessionDate,
      s.timeSlot,
      s.duration,
      s.distance || "",
      s.rpe,
      s.performance,
      s.engagement,
      s.fatigue,
      computeLoad(s.duration, s.rpe),
      (s.comments || "").replace(/\n/g, " "),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "suivi_natation.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  exportJsonBtn?.addEventListener("click", () => {
    const mine = getMine();

    if (!mine.length) return alert("Aucune séance à exporter.");

    const blob = new Blob([JSON.stringify(mine, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "suivi_natation.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  clearDataBtn?.addEventListener("click", () => {
    if (!confirm("Voulez-vous vraiment supprimer toutes les données enregistrées ?")) return;
    sessions = [];
    saveSessions();
    updateTable();
    renderKpis();
    renderCharts();
    setStatus("Données locales supprimées.", "info");
  });

  // Re-render charts on resize (responsive canvases)
  window.addEventListener("resize", () => {
    renderCharts();
  });

  
  coachToggleHistoryBtn?.addEventListener("click", () => {
    if (!coachHistoryWrap) return;
    const isHidden = coachHistoryWrap.classList.contains("hidden");
    coachHistoryWrap.classList.toggle("hidden");
    coachToggleHistoryBtn.textContent = isHidden ? "Masquer l'historique" : "Afficher l'historique";
    if (isHidden) updateCoachHistoryTable();
  });

// ====== INIT ======
  setStatus("", "");
  loadSessions();
  ensureCoachOptionsFromSessions();
  if (sessionStorage.getItem("coachAccess") === "1") { setCoachMode(true); }

  populateDistanceOptions();
  applyStoredNameUI();
  ensureDefaults();
  sessions = sortSessionsDesc(sessions);

  updateRangeButtons();
  setActiveRangeButtons(hofRangeBtns, hofRangeDays);
  updateTable();
  renderKpis();
  renderCharts();
});
