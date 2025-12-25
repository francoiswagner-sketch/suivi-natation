/* swim_app - script.js (Google Sheets sync + dropdown UI + matin/soir) */

document.addEventListener("DOMContentLoaded", () => {
  // ====== CONFIG ======
  const SYNC_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwYV8nDCmm6LbYtZRlmLRPepd1eH2qd9D909i8UCcJCTjRiGzo4OiNKgRWtX4rUmIhYgQ/exec?token=ersteinaquaticclub2026";

  const STORAGE_SESSIONS_KEY = "swimSessions";
  const STORAGE_NAME_KEY = "swimmerName";

  // ====== DOM ======
  const form = document.getElementById("session-form");

  const athleteNameInput = document.getElementById("athleteName");
  const sessionDateInput = document.getElementById("sessionDate");
  const timeSlotSelect = document.getElementById("timeSlot"); // "matin" / "soir"

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

  const statusEl = document.getElementById("status");

  // ====== STATE ======
  let sessions = [];

  // ====== Helpers ======
  function setStatus(message, type = "info") {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.dataset.type = type; // si tu veux styler via CSS
    statusEl.classList.toggle("hidden", !message);
  }

  function safeParseInt(val) {
    const n = parseInt(String(val), 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function todayISODate() {
    // YYYY-MM-DD
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function loadSessions() {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    try {
      sessions = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(sessions)) sessions = [];
    } catch {
      sessions = [];
    }
  }

  function saveSessions() {
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  }

  function computeTrainingLoad(duration, rpe) {
    const d = Number(duration);
    const r = Number(rpe);
    if (!Number.isFinite(d) || !Number.isFinite(r)) return "";
    return d * r;
  }

  function formatDateForDisplay(yyyyMmDd) {
    // affiche en format local “JJ/MM/AAAA” selon le navigateur
    try {
      const [y, m, d] = String(yyyyMmDd).split("-").map((x) => parseInt(x, 10));
      const dt = new Date(y, (m || 1) - 1, d || 1);
      return dt.toLocaleDateString();
    } catch {
      return yyyyMmDd;
    }
  }

  function ensureDefaultDateAndSlot() {
    if (sessionDateInput && !sessionDateInput.value) {
      sessionDateInput.value = todayISODate();
    }
    if (timeSlotSelect && !timeSlotSelect.value) {
      // valeur par défaut : matin (à adapter si tu veux)
      timeSlotSelect.value = "matin";
    }
  }

  function applyStoredNameBehavior() {
    const stored = localStorage.getItem(STORAGE_NAME_KEY);
    if (stored && athleteNameInput) {
      // Important : éviter le bug iOS “required + hidden”
      athleteNameInput.value = stored;
      athleteNameInput.disabled = true;
      athleteNameInput.removeAttribute("required");
    } else if (athleteNameInput) {
      athleteNameInput.disabled = false;
      athleteNameInput.setAttribute("required", "required");
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
      tr.appendChild(td(formatDateForDisplay(s.sessionDate), labels[1]));
      tr.appendChild(td(s.timeSlot, labels[2]));
      tr.appendChild(td(s.duration, labels[3]));
      tr.appendChild(td(s.rpe, labels[4]));
      tr.appendChild(td(s.performance, labels[5]));
      tr.appendChild(td(s.engagement, labels[6]));
      tr.appendChild(td(s.fatigue, labels[7]));
      tr.appendChild(td(computeTrainingLoad(s.duration, s.rpe), labels[8]));
      tr.appendChild(td(s.comments || "", labels[9]));

      sessionsBody.appendChild(tr);
    });
  }

  async function syncSession(session) {
    if (!SYNC_ENDPOINT) return { ok: false, error: "SYNC_ENDPOINT vide" };

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
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${txt}` };
    }
    if (txt !== "OK") {
      return { ok: false, error: txt || "Réponse inattendue" };
    }
    return { ok: true };
  }

  // ====== Actions ======
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("", "info"); // clear

    // Nom (depuis storage si input désactivé)
    const storedName = localStorage.getItem(STORAGE_NAME_KEY);
    const athleteName = storedName || (athleteNameInput?.value || "").trim();

    const sessionDate = sessionDateInput?.value || "";
    const timeSlot = timeSlotSelect?.value || "";

    const duration = safeParseInt(durationSelect?.value);
    const rpe = safeParseInt(rpeSelect?.value);
    const performance = safeParseInt(performanceSelect?.value);
    const engagement = safeParseInt(engagementSelect?.value);
    const fatigue = safeParseInt(fatigueSelect?.value);
    const comments = (commentsInput?.value || "").trim();

    // Validation minimale
    if (!athleteName) {
      setStatus("Merci d’indiquer votre nom.", "error");
      return;
    }
    if (!sessionDate) {
      setStatus("Merci de sélectionner une date.", "error");
      return;
    }
    if (!timeSlot) {
      setStatus("Merci de choisir Matin ou Soir.", "error");
      return;
    }
    if ([duration, rpe, performance, engagement, fatigue].some((x) => Number.isNaN(x))) {
      setStatus("Merci de sélectionner toutes les valeurs (durée, RPE, etc.).", "error");
      return;
    }

    // Mémoriser le nom une fois
    if (!storedName) {
      localStorage.setItem(STORAGE_NAME_KEY, athleteName);
      applyStoredNameBehavior();
    }

    const session = {
      athleteName,
      sessionDate,  // YYYY-MM-DD
      timeSlot,     // "matin" / "soir"
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
      const result = await syncSession(session);
      if (result.ok) {
        setStatus("✅ Séance enregistrée et envoyée au coach.", "success");
      } else {
        setStatus(
          "⚠️ Séance enregistrée sur le téléphone, mais envoi au coach impossible : " +
            (result.error || "réseau / token / droits"),
          "error"
        );
      }
    } catch (err) {
      setStatus(
        "⚠️ Séance enregistrée sur le téléphone, mais envoi au coach impossible (réseau / token / droits).",
        "error"
      );
      console.error(err);
    }

    // Reset partiel : on garde la date du jour + créneau, et le nom (stocké)
    if (commentsInput) commentsInput.value = "";
    ensureDefaultDateAndSlot();
  });

  exportCsvBtn?.addEventListener("click", () => {
    if (!sessions.length) {
      alert("Aucune séance à exporter.");
      return;
    }
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
      computeTrainingLoad(s.duration, s.rpe),
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
    if (!sessions.length) {
      alert("Aucune séance à exporter.");
      return;
    }
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
    setStatus("Données locales supprimées.", "info");
  });

  // ====== INIT ======
  setStatus("", "info"); // éviter tout message au chargement
  loadSessions();
  applyStoredNameBehavior();
  ensureDefaultDateAndSlot();
  updateTable();
});
