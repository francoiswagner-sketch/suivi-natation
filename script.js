/* swim_app - script.js (Google Sheets sync + récupération + indicateurs + km) */

document.addEventListener("DOMContentLoaded", () => {
  // ====== CONFIG ======
  const SYNC_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwYV8nDCmm6LbYtZRlmLRPepd1eH2qd9D909i8UCcJCTjRiGzo4OiNKgRWtX4rUmIhYgQ/exec?token=ersteinaquaticclub2026";

  const STORAGE_SESSIONS_KEY = "swimSessions";
  const STORAGE_NAME_KEY = "swimmerName";

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

  const rpeSelect = document.getElementById("rpe");
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

  // ====== STATE ======
  let sessions = [];

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

  function parseISODateToDate(yyyyMmDd) {
    // yyyy-mm-dd -> Date (local)
    const [y, m, d] = String(yyyyMmDd).split("-").map((x) => parseInt(x, 10));
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function computeLoad(duration, rpe) {
    const d = Number(duration);
    const r = Number(rpe);
    if (!Number.isFinite(d) || !Number.isFinite(r)) return "";
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
      storedNameEl.textContent = stored;
      storedNameDisplay.classList.remove("hidden");
      athleteNameWrapper.classList.add("hidden");

      // Évite les blocages Safari iOS (required + champ caché)
      athleteNameInput.value = stored;
      athleteNameInput.disabled = true;
      athleteNameInput.removeAttribute("required");
    } else {
      storedNameDisplay.classList.add("hidden");
      athleteNameWrapper.classList.remove("hidden");
      athleteNameInput.disabled = false;
      athleteNameInput.setAttribute("required", "required");
      athleteNameInput.value = "";
    }
  }

  function ensureDefaults() {
    if (sessionDateInput && !sessionDateInput.value) sessionDateInput.value = todayISODate();
    if (timeSlotSelect && !timeSlotSelect.value) timeSlotSelect.value = "matin";
  }

  function populateDistanceOptions() {
    if (!distanceSelect) return;
    // Ne pas dupliquer si déjà rempli
    if (distanceSelect.querySelector("option[value='2000']")) return;

    for (let m = 2000; m <= 7000; m += 100) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = `${m} m`;
      distanceSelect.appendChild(opt);
    }
  }

  function sessionKey(s) {
    // Clé stable pour éviter les doublons lors de la récupération
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
      // Date desc, puis matin/soir
      const da = parseISODateToDate(a.sessionDate).getTime();
      const db = parseISODateToDate(b.sessionDate).getTime();
      if (da !== db) return db - da;
      // Soir après matin (ordre logique de la journée)
      return (a.timeSlot === "soir" ? 1 : 0) - (b.timeSlot === "soir" ? 1 : 0);
    });
  }

  function updateTable() {
    if (!sessionsTable || !sessionsBody || !noSessions) return;
    sessionsBody.innerHTML = "";

    if (!sessions.length) {
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
      "RPE",
      "Performance",
      "Engagement",
      "Fatigue",
      "Charge",
      "Commentaires",
    ];

    sessions.forEach((s) => {
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

  function renderKpis() {
    if (!kpisEl) return;
    const storedName = localStorage.getItem(STORAGE_NAME_KEY) || "";
    const mine = storedName ? sessions.filter((s) => s.athleteName === storedName) : sessions;

    if (!mine.length) {
      kpisEl.innerHTML = "";
      return;
    }

    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);

    const last7 = mine.filter((s) => parseISODateToDate(s.sessionDate) >= d7);
    const last30 = mine.filter((s) => parseISODateToDate(s.sessionDate) >= d30);

    function avg(list, key) {
      if (!list.length) return null;
      const vals = list
        .map((s) => Number(s[key]))
        .filter((v) => Number.isFinite(v));
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    function sum(list, key) {
      return list
        .map((s) => Number(s[key]))
        .filter((v) => Number.isFinite(v))
        .reduce((a, b) => a + b, 0);
    }

    const totalSessions = mine.length;
    const sessions7 = last7.length;
    const sessions30 = last30.length;

    const avgPerf7 = avg(last7, "performance");
    const avgEng7 = avg(last7, "engagement");
    const avgFat7 = avg(last7, "fatigue");
    const avgRpe7 = avg(last7, "rpe");

    const totalMin7 = sum(last7, "duration");
    const totalLoad7 = last7.reduce((acc, s) => acc + (computeLoad(s.duration, s.rpe) || 0), 0);
    const totalDist7 = sum(last7, "distance");

    const cards = [
      { label: "Séances (7j)", value: sessions7 },
      { label: "Séances (30j)", value: sessions30 },
      { label: "Performance moy. (7j)", value: avgPerf7 != null ? avgPerf7.toFixed(1) : "—" },
      { label: "Engagement moy. (7j)", value: avgEng7 != null ? avgEng7.toFixed(1) : "—" },
      { label: "Fatigue moy. (7j)", value: avgFat7 != null ? avgFat7.toFixed(1) : "—" },
      { label: "RPE moy. (7j)", value: avgRpe7 != null ? avgRpe7.toFixed(1) : "—" },
      { label: "Durée totale (7j)", value: `${totalMin7} min` },
      { label: "Charge totale (7j)", value: Math.round(totalLoad7) },
      { label: "Distance totale (7j)", value: totalDist7 ? `${totalDist7} m` : "—" },
      { label: "Total séances", value: totalSessions },
    ];

    kpisEl.innerHTML = cards
      .map(
        (c) =>
          `<div class="kpi-card"><div class="kpi-value">${c.value}</div><div class="kpi-label">${c.label}</div></div>`
      )
      .join("");
  }

  async function syncSession(session) {
    const res = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...session, userAgent: navigator.userAgent }),
    });
    const txt = (await res.text()).trim();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);
    if (txt !== "OK") throw new Error(txt || "Réponse inattendue");
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

    // App Script : on utilise doGet avec action=get
    const url = new URL(SYNC_ENDPOINT);
    url.searchParams.set("action", "get");
    url.searchParams.set("athleteName", storedName);
    url.searchParams.set("limit", "50");

    setStatus("Récupération des séances…", "info");

    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    const txt = await res.text();

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      throw new Error(`Réponse non JSON : ${txt.slice(0, 120)}`);
    }

    if (!data || !Array.isArray(data.sessions)) {
      throw new Error("Format inattendu (sessions manquant)");
    }

    // Normalisation + dédoublonnage
    const fetched = data.sessions
      .map((s) => ({
        athleteName: s.athleteName,
        sessionDate: s.sessionDate,
        timeSlot: s.timeSlot,
        duration: safeInt(s.duration),
        distance: s.distance ? safeInt(s.distance) : "",
        rpe: safeInt(s.rpe),
        performance: safeInt(s.performance),
        engagement: safeInt(s.engagement),
        fatigue: safeInt(s.fatigue),
        comments: s.comments || "",
      }))
      .filter((s) => s.athleteName && s.sessionDate && !Number.isNaN(s.duration) && !Number.isNaN(s.rpe));

    const byKey = new Map();
    [...sessions, ...fetched].forEach((s) => byKey.set(sessionKey(s), s));
    sessions = sortSessionsDesc([...byKey.values()]);
    saveSessions();
    updateTable();
    renderKpis();
    setStatus(`✅ ${fetched.length} séance(s) récupérée(s) depuis Google Sheets.`, "success");
  }

  // ====== EVENTS ======
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    const storedName = localStorage.getItem(STORAGE_NAME_KEY);
    const athleteName = (storedName || athleteNameInput.value || "").trim();

    const sessionDate = sessionDateInput.value;
    const timeSlot = timeSlotSelect.value;

    const duration = safeInt(durationSelect.value);
    const distance = distanceSelect.value ? safeInt(distanceSelect.value) : "";

    const rpe = safeInt(rpeSelect.value);
    const performance = safeInt(performanceSelect.value);
    const engagement = safeInt(engagementSelect.value);
    const fatigue = safeInt(fatigueSelect.value);
    const comments = (commentsInput.value || "").trim();

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
    updateTable();
    renderKpis();

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
    commentsInput.value = "";
    if (distanceSelect) distanceSelect.value = "";
    ensureDefaults();
  });

  changeNameBtn?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_NAME_KEY);
    applyStoredNameUI();
    setStatus("Nom réinitialisé.", "info");
    renderKpis();
  });

  fetchLatestBtn?.addEventListener("click", async () => {
    try {
      await fetchLatestSessions();
    } catch (err) {
      console.error(err);
      setStatus("⚠️ Impossible de récupérer : " + (err?.message || "erreur"), "error");
    }
  });

  exportCsvBtn?.addEventListener("click", () => {
    if (!sessions.length) return alert("Aucune séance à exporter.");
    const headers = [
      "Nom",
      "Date",
      "Créneau",
      "Durée (min)",
      "Distance (m)",
      "RPE",
      "Performance",
      "Engagement",
      "Fatigue",
      "Charge",
      "Commentaires",
    ];
    const rows = sessions.map((s) => [
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
    if (!sessions.length) return alert("Aucune séance à exporter.");
    const blob = new Blob([JSON.stringify(sessions, null, 2)], {
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
    setStatus("Données locales supprimées.", "info");
  });

  // ====== INIT ======
  setStatus("", "");
  loadSessions();
  populateDistanceOptions();
  applyStoredNameUI();
  ensureDefaults();
  sessions = sortSessionsDesc(sessions);
  updateTable();
  renderKpis();
});
