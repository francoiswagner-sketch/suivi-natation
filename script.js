/* swim_app - script.js
   - Saisie sans clavier (menus déroulants)
   - Enregistrement local + synchronisation Google Sheets
   - Récupération des dernières séances (GET JSON)
   - KPIs + graphiques (canvas) avec toggle 7j / 30j / 365j
*/

document.addEventListener("DOMContentLoaded", () => {
  // ====== CONFIG ======
  // Mets ici l’URL /exec de ton déploiement Apps Script (avec ?token=...)
  const SYNC_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwby5u05iYNVzuj7_oGLpFoKeuOrWKYaSrsGKRKS4puazSeTgyj0ZhqnTBUaSFYQb4ZGQ/exec?token=ersteinaquaticclub2026";

  const STORAGE_SESSIONS_KEY = "swimSessions";
  const STORAGE_NAME_KEY = "swimmerName";
  const STORAGE_RANGE_KEY = "kpiRangeDays"; // 7 | 30 | 365

  // ====== DOM ======
  const form = document.getElementById("session-form");

  const athleteNameWrapper = document.getElementById("athleteNameWrapper");
  const athleteNameInput = document.getElementById("athleteName");
  const storedNameDisplay = document.getElementById("storedNameDisplay");
  const storedNameEl = document.getElementById("storedName");
  const changeNameBtn = document.getElementById("changeName");

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

  const exportCsvBtn = document.getElementById("export-csv");
  const exportJsonBtn = document.getElementById("export-json");
  const clearDataBtn = document.getElementById("clear-data");

  const statusEl = document.getElementById("sync-status");

  const rangeBtns = Array.from(document.querySelectorAll(".range-btn"));

  const chartRpe = document.getElementById("chart-rpe");
  const chartPerformance = document.getElementById("chart-performance");
  const chartEngagement = document.getElementById("chart-engagement");
  const chartFatigue = document.getElementById("chart-fatigue");

  // ====== STATE ======
  let sessions = [];
  let rangeDays = Number(localStorage.getItem(STORAGE_RANGE_KEY) || "7");
  if (![7, 30, 365].includes(rangeDays)) rangeDays = 7;

  // ====== Helpers ======
  function setStatus(message, type = "") {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.remove("success", "error", "info");
    if (type) statusEl.classList.add(type);
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

    // Autres formats (Date.parse)
    const dt = new Date(s);
    return dt;
  }

  function toISODateString(value) {
    const dt = parseAnyDateToDate(value);
    if (!Number.isFinite(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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
      sessions = Array.isArray(parsed) ? parsed : [];
    } catch {
      sessions = [];
    }
  }

  function saveSessions() {
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  }

  function applyStoredNameUI() {
    const stored = localStorage.getItem(STORAGE_NAME_KEY);
    if (stored) {
      if (storedNameEl) storedNameEl.textContent = stored;
      storedNameDisplay?.classList.remove("hidden");
      athleteNameWrapper?.classList.add("hidden");

      // Évite les blocages Safari iOS (required + champ caché)
      if (athleteNameInput) {
        athleteNameInput.value = stored;
        athleteNameInput.disabled = true;
        athleteNameInput.removeAttribute("required");
      }
    } else {
      storedNameDisplay?.classList.add("hidden");
      athleteNameWrapper?.classList.remove("hidden");

      if (athleteNameInput) {
        athleteNameInput.disabled = false;
        athleteNameInput.setAttribute("required", "required");
        athleteNameInput.value = "";
      }
    }
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
      b.classList.toggle("active", Number(b.dataset.range) === rangeDays);
      b.setAttribute("aria-pressed", Number(b.dataset.range) === rangeDays ? "true" : "false");
    });
  }

  // ====== Table ======
  function updateTable() {
    if (!sessionsTable || !sessionsBody || !noSessions) return;
    sessionsBody.innerHTML = "";

    const mine = getMine();

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

    mine.forEach((s) => {
      const tr = document.createElement("tr");

      function td(val, label) {
        const cell = document.createElement("td");
        cell.textContent = val == null || val === "" ? "" : String(val);
        cell.setAttribute("data-label", label);
        return cell;
      }

      tr.appendChild(td(s.athleteName, labels[0]));
      tr.appendChild(td(s.sessionDate, labels[1]));
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
    const map = new Map(); // date -> {sum, count}
    list.forEach((s) => {
      const d = toISODateString(s.sessionDate);
      const v = Number(s[key]);
      if (!d || !Number.isFinite(v)) return;
      const cur = map.get(d) || { sum: 0, count: 0 };
      cur.sum += v;
      cur.count += 1;
      map.set(d, cur);
    });

    const pts = Array.from(map.entries())
      .map(([date, agg]) => ({
        date,
        x: parseAnyDateToDate(date),
        y: agg.sum / agg.count,
      }))
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
    const { width: w, height: h } = resizeCanvasForHiDpi(canvas);
    clearCanvas(ctx, w, h);

    // empty state
    if (!points || points.length < 2) {
      ctx.font = `${Math.round(12 * (window.devicePixelRatio || 1))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillStyle = "#6b7280";
      ctx.textAlign = "center";
      ctx.fillText("Pas assez de données", w / 2, h / 2);
      return;
    }

    const padL = Math.round(38 * (window.devicePixelRatio || 1));
    const padR = Math.round(14 * (window.devicePixelRatio || 1));
    const padT = Math.round(16 * (window.devicePixelRatio || 1));
    const padB = Math.round(26 * (window.devicePixelRatio || 1));

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const yMin = 1;
    const yMax = 10;

    const xMin = points[0].x.getTime();
    const xMax = points[points.length - 1].x.getTime() || xMin + 1;

    const xToPx = (t) => padL + ((t - xMin) / (xMax - xMin)) * plotW;
    const yToPx = (y) => padT + (1 - (y - yMin) / (yMax - yMin)) * plotH;


// background zones (optional)
if (opts && Array.isArray(opts.zones) && opts.zones.length) {
  ctx.save();
  const prevAlpha = ctx.globalAlpha;
  opts.zones.forEach((z) => {
    const y1 = yToPx(z.to);
    const y0 = yToPx(z.from);
    ctx.globalAlpha = ("alpha" in z) ? z.alpha : 0.12;
    ctx.fillStyle = z.color || "rgba(16,185,129,1)";
    ctx.fillRect(padL, Math.min(y0, y1), plotW, Math.abs(y1 - y0));
  });
  ctx.globalAlpha = prevAlpha;
  ctx.restore();
}

    // grid lines (y)
    ctx.strokeStyle = "rgba(17,24,39,0.08)";
    ctx.lineWidth = Math.max(1, Math.round(1 * (window.devicePixelRatio || 1)));
    for (let y = 2; y <= 10; y += 2) {
      const py = yToPx(y);
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();
    }

    // axes labels (y: 1 and 10)
    ctx.fillStyle = "#6b7280";
    ctx.font = `${Math.round(11 * (window.devicePixelRatio || 1))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "right";
    ctx.fillText("10", padL - 6, yToPx(10) + 4);
    ctx.fillText("1", padL - 6, yToPx(1) + 4);

    // title
    if (opts?.title) {
      ctx.fillStyle = "#111827";
      ctx.textAlign = "left";
      ctx.font = `${Math.round(12 * (window.devicePixelRatio || 1))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText(opts.title, padL, padT - 4);
    }

    // line
    ctx.strokeStyle = "rgba(47,111,235,0.9)";
    ctx.lineWidth = Math.max(2, Math.round(2 * (window.devicePixelRatio || 1)));
    ctx.beginPath();
    points.forEach((p, i) => {
      const px = xToPx(p.x.getTime());
      const py = yToPx(p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // dots
    ctx.fillStyle = "rgba(47,111,235,1)";
    const r = Math.max(2, Math.round(2.5 * (window.devicePixelRatio || 1)));
    points.forEach((p) => {
      const px = xToPx(p.x.getTime());
      const py = yToPx(p.y);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // x labels: show first, last, and a few in-between
    ctx.fillStyle = "#6b7280";
    ctx.font = `${Math.round(11 * (window.devicePixelRatio || 1))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";

    const labelCount = Math.min(4, points.length);
    const idxs = new Set([0, points.length - 1]);
    if (labelCount > 2) {
      idxs.add(Math.floor(points.length / 3));
      idxs.add(Math.floor((2 * points.length) / 3));
    }
    Array.from(idxs)
      .sort((a, b) => a - b)
      .forEach((i) => {
        const p = points[i];
        const px = xToPx(p.x.getTime());
        const label = p.date.slice(5); // MM-DD
        ctx.fillText(label, px, padT + plotH + Math.round(18 * (window.devicePixelRatio || 1)));
      });
  }

  function renderCharts() {
    const mine = getMine();
    const inRange = filterByDays(mine, rangeDays);

    const rpePts = groupDailyAverage(inRange, "rpe");
    const perfPts = groupDailyAverage(inRange, "performance");
    const engPts = groupDailyAverage(inRange, "engagement");
    const fatPts = groupDailyAverage(inRange, "fatigue");


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
      setStatus("Merci d’abord de renseigner votre nom (en haut).", "error");
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
    sessions = sortSessionsDesc([...byKey.values()]);
    saveSessions();

    updateRangeButtons();
    updateTable();
    renderKpis();
    renderCharts();

    setStatus(`✅ ${fetched.length} séance(s) récupérée(s).`, "success");
  }

  // ====== Events ======
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    const storedName = localStorage.getItem(STORAGE_NAME_KEY);
    const athleteName = (storedName || athleteNameInput?.value || "").trim();

    const sessionDate = sessionDateInput?.value || "";
    const timeSlot = timeSlotSelect?.value || "";

    const duration = safeInt(durationSelect?.value);
    const distance = distanceSelect?.value ? safeInt(distanceSelect.value) : "";

    const rpe = safeInt(rpeSelect?.value);
    const performance = safeInt(performanceSelect?.value);
    const engagement = safeInt(engagementSelect?.value);
    const fatigue = safeInt(fatigueSelect?.value);
    const comments = (commentsInput?.value || "").trim();

    if (!athleteName) return setStatus("Merci d’indiquer votre nom.", "error");
    if (!sessionDate) return setStatus("Merci de sélectionner une date.", "error");
    if (!timeSlot) return setStatus("Merci de choisir Matin ou Soir.", "error");
    if ([duration, rpe, performance, engagement, fatigue].some((x) => Number.isNaN(x))) {
      return setStatus("Merci de sélectionner toutes les valeurs.", "error");
    }

    if (!storedName) {
      localStorage.setItem(STORAGE_NAME_KEY, athleteName);
      applyStoredNameUI();
    }

    const session = {
      athleteName,
      sessionDate,
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
    sessions = sortSessionsDesc(sessions);
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

  changeNameBtn?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_NAME_KEY);
    applyStoredNameUI();
    setStatus("Nom réinitialisé.", "info");
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
      rangeDays = days;
      localStorage.setItem(STORAGE_RANGE_KEY, String(rangeDays));
      updateRangeButtons();
      renderKpis();
      renderCharts();
    });
  });

  exportCsvBtn?.addEventListener("click", () => {
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

  // ====== INIT ======
  setStatus("", "");
  loadSessions();
  populateDistanceOptions();
  applyStoredNameUI();
  ensureDefaults();
  sessions = sortSessionsDesc(sessions);

  updateRangeButtons();
  updateTable();
  renderKpis();
  renderCharts();
});
