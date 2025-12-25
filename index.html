/* swim_app - script.js (compatible avec ton index.html) */

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
  const timeSlotSelect = document.getElementById("timeSlot"); // matin/soir

  const durationSelect = document.getElementById("duration");
  const rpeSelect = document.getElementById("rpe");
  const performanceSelect = document.getElementById("performance");
  const engagementSelect = document.getElementById("engagement");
  const fatigueSelect = document.getElementById("fatigue");
  const commentsInput = document.getElementById("comments");

  const sessionsTable = document.getElementById("sessions-table");
  const sessionsBody = sessionsTable ? sessionsTable.querySelector("tbody") : null;
  const noSessions = document.getElementById("no-sessions");

  const exportCsvBtn = document.getElementById("export-csv");
  const exportJsonBtn = document.getElementById("export-json");
  const clearDataBtn = document.getElementById("clear-data");

  // IMPORTANT : ton HTML utilise sync-status
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
      // On affiche la zone "Nom : X" + bouton changer
      storedNameEl.textContent = stored;
      storedNameDisplay.classList.remove("hidden");
      athleteNameWrapper.classList.add("hidden");

      // Très important : éviter bug Safari iOS (required + champ caché)
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
    if (sessionDateInput && !sessionDateInput.value) {
      sessionDateInput.value = todayISODate();
    }
    if (timeSlotSelect && !timeSlotSelect.value) {
      timeSlotSelect.value = "matin";
    }
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

    // Labels utilisés pour l’affichage mobile (data-label)
    const labels = [
      "Nom",
      "Date",
      "Créneau",
      "Durée (min)",
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
        cell.textContent = val == null ? "" : String(val);
        cell.setAttribute("data-label", label);
        return cell;
      }

      tr.appendChild(td(s.athleteName, labels[0]));
      tr.appendChild(td(s.sessionDate, labels[1]));
      tr.appendChild(td(s.timeSlot, labels[2])); // <- ajout créneau
      tr.appendChild(td(s.duration, labels[3]));
      tr.appendChild(td(s.rpe, labels[4]));
      tr.appendChild(td(s.performance, labels[5]));
      tr.appendChild(td(s.engagement, labels[6]));
      tr.appendChild(td(s.fatigue, labels[7]));
      tr.appendChild(td(computeLoad(s.duration, s.rpe), labels[8]));
      tr.appendChild(td(s.comments || "", labels[9]));

      sessionsBody.appendChild(tr);
    });
  }

  async function syncSession(session) {
    // POST en text/plain pour éviter le preflight CORS Apps Script
    const res = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        ...session,
        userAgent: navigator.userAgent,
      }),
    });

    const txt = (await res.text()).trim();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);
    if (txt !== "OK") throw new Error(txt || "Réponse inattendue");
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
    const rpe = safeInt(rpeSelect.value);
    const performance = safeInt(performanceSelect.value);
    const engagement = safeInt(engagementSelect.value);
    const fatigue = safeInt(fatigueSelect.value);
    const comments = (commentsInput.value || "").trim();

    // Validation
    if (!athleteName) return setStatus("Merci d’indiquer votre nom.", "error");
    if (!sessionDate) return setStatus("Merci de sélectionner une date.", "error");
    if (!timeSlot) return setStatus("Merci de choisir Matin ou Soir.", "error");
    if ([duration, rpe, performance, engagement, fatigue].some((x) => Number.isNaN(x))) {
      return setStatus("Merci de sélectionner toutes les valeurs.", "error");
    }

    // Mémoriser le nom si première fois
    if (!storedName) {
      localStorage.setItem(STORAGE_NAME_KEY, athleteName);
      applyStoredNameUI();
    }

    const session = {
      athleteName,
      sessionDate,
      timeSlot,
      duration,
      rpe,
      performance,
      engagement,
      fatigue,
      comments,
    };

    // Sauvegarde locale immédiate
    sessions.push(session);
    saveSessions();
    updateTable();

    // Sync distante
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
    ensureDefaults();
  });

  changeNameBtn?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_NAME_KEY);
    applyStoredNameUI();
    setStatus("Nom réinitialisé.", "info");
  });

  exportCsvBtn?.addEventListener("click", () => {
    if (!sessions.length) return alert("Aucune séance à exporter.");

    const headers = [
      "Nom",
      "Date",
      "Créneau",
      "Durée (min)",
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
      type: "application/json;charset=utf-8",
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
    setStatus("Données locales supprimées.", "info");
  });

  // ====== INIT ======
  setStatus("", "");
  loadSessions();
  applyStoredNameUI();
  ensureDefaults();
  updateTable();
});
