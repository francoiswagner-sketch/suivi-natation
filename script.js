/*
 * Gestion du suivi des séances de natation.
 *
 * Ce fichier gère la collecte des données via le formulaire,
 * l'enregistrement en local (localStorage), l'affichage
 * dynamique des séances dans un tableau ainsi que les
 * fonctionnalités d'exportation (CSV/JSON) et de suppression.
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('session-form');
  const sessionsTable = document.getElementById('sessions-table');
  const sessionsBody = sessionsTable.querySelector('tbody');
  const noSessions = document.getElementById('no-sessions');
  const exportCsvBtn = document.getElementById('export-csv');
  const exportJsonBtn = document.getElementById('export-json');
  const clearDataBtn = document.getElementById('clear-data');

  // Gestion du nom du nageur : zones de saisie et d'affichage
  const athleteNameWrapper = document.getElementById('athleteNameWrapper');
  const storedNameDisplay = document.getElementById('storedNameDisplay');
  const storedNameEl = document.getElementById('storedName');
  const changeNameBtn = document.getElementById('changeName');

  // Entrées de type range et leurs affichages correspondants
  const durationInput = document.getElementById('duration');
  const durationValue = document.getElementById('duration-value');
  const rpeInput = document.getElementById('rpe');
  const rpeValue = document.getElementById('rpe-value');
  const performanceInput = document.getElementById('performance');
  const performanceValue = document.getElementById('performance-value');
  const engagementInput = document.getElementById('engagement');
  const engagementValue = document.getElementById('engagement-value');
  const fatigueInput = document.getElementById('fatigue');
  const fatigueValue = document.getElementById('fatigue-value');

  // Point d'API pour la synchronisation automatique (Google Apps Script Web App)
  // IMPORTANT : remplacez VOTRE_TOKEN_SECRET par le même token que dans Apps Script (SHARED_TOKEN).
  const SYNC_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwYV8nDCmm6LbYtZRlmLRPepd1eH2qd9D909i8UCcJCTjRiGzo4OiNKgRWtX4rUmIhYgQ/exec?token=ersteinaquaticclub2026';


  // Tableau interne pour stocker les séances chargées depuis le localStorage
  let sessions = [];

  /**
   * Charge les séances stockées depuis le localStorage. Si aucune donnée
   * n'est trouvée, initialise un tableau vide.
   */
  function loadSessions() {
    const stored = localStorage.getItem('swimSessions');
    try {
      sessions = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Erreur lors du chargement des données :', e);
      sessions = [];
    }
    updateTable();
  }

  /**
   * Enregistre la liste des séances dans le localStorage.
   */
  function saveSessions() {
    localStorage.setItem('swimSessions', JSON.stringify(sessions));
  }

  /**
   * Met à jour l'affichage des entrées range lorsque l'utilisateur
   * modifie leur valeur. Chaque champ range dispose d'un span
   * associé pour afficher la valeur courante.
   */
  function setupRangeUpdates() {
    function bindRange(input, output) {
      if (!input || !output) return;
      output.textContent = input.value;
      input.addEventListener('input', () => {
        output.textContent = input.value;
      });
    }
    bindRange(durationInput, durationValue);
    bindRange(rpeInput, rpeValue);
    bindRange(performanceInput, performanceValue);
    bindRange(engagementInput, engagementValue);
    bindRange(fatigueInput, fatigueValue);
  }

  /**
   * Charge et affiche le nom du nageur depuis le localStorage.
   */
  function loadStoredName() {
    const stored = localStorage.getItem('swimmerName');
    if (stored) {
      athleteNameWrapper.classList.add('hidden');
      storedNameDisplay.classList.remove('hidden');
      storedNameEl.textContent = stored;
    } else {
      athleteNameWrapper.classList.remove('hidden');
      storedNameDisplay.classList.add('hidden');
    }
  }

  /**
   * Envoie la séance à Google Apps Script si SYNC_ENDPOINT est défini.
   */
  function syncSession(session) {
    if (!SYNC_ENDPOINT) return;

    // Apps Script Web App : envoyer le JSON en *texte* pour éviter le preflight CORS
    // et suivre les redirections (Apps Script renvoie souvent un 302).
    fetch(SYNC_ENDPOINT, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        ...session,
        userAgent: navigator.userAgent
      })
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Code HTTP inattendu : ${response.status}`);
        }
      })
      .catch((error) => {
        console.error('Erreur lors de la synchronisation :', error);
      });
  }

  /**
   * Met à jour l'affichage du tableau des séances.
   */
  function updateTable() {
    sessionsBody.innerHTML = '';
    if (sessions.length === 0) {
      sessionsTable.classList.add('hidden');
      noSessions.classList.remove('hidden');
      return;
    }
    sessionsTable.classList.remove('hidden');
    noSessions.classList.add('hidden');

    sessions.forEach((session) => {
      const tr = document.createElement('tr');
      const labels = [
        'Nom',
        'Date',
        'Durée (min)',
        'RPE',
        'Performance',
        'Engagement',
        'Fatigue',
        'Charge',
        'Commentaires'
      ];

      const nameCell = document.createElement('td');
      nameCell.textContent = session.athleteName;
      nameCell.setAttribute('data-label', labels[0]);
      tr.appendChild(nameCell);

      const dateCell = document.createElement('td');
      let dateStr;
      try {
        const date = new Date(session.sessionDate);
        dateStr = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
      } catch (e) {
        dateStr = session.sessionDate;
      }
      dateCell.textContent = dateStr;
      dateCell.setAttribute('data-label', labels[1]);
      tr.appendChild(dateCell);

      const durationCell = document.createElement('td');
      durationCell.textContent = session.duration;
      durationCell.setAttribute('data-label', labels[2]);
      tr.appendChild(durationCell);

      const rpeCell = document.createElement('td');
      rpeCell.textContent = session.rpe;
      rpeCell.setAttribute('data-label', labels[3]);
      tr.appendChild(rpeCell);

      const perfCell = document.createElement('td');
      perfCell.textContent = session.performance;
      perfCell.setAttribute('data-label', labels[4]);
      tr.appendChild(perfCell);

      const engagementCell = document.createElement('td');
      engagementCell.textContent = session.engagement;
      engagementCell.setAttribute('data-label', labels[5]);
      tr.appendChild(engagementCell);

      const fatigueCell = document.createElement('td');
      fatigueCell.textContent = session.fatigue;
      fatigueCell.setAttribute('data-label', labels[6]);
      tr.appendChild(fatigueCell);

      const loadCell = document.createElement('td');
      const load = session.duration * session.rpe;
      loadCell.textContent = load;
      loadCell.setAttribute('data-label', labels[7]);
      tr.appendChild(loadCell);

      const commentsCell = document.createElement('td');
      commentsCell.textContent = session.comments || '';
      commentsCell.setAttribute('data-label', labels[8]);
      tr.appendChild(commentsCell);

      sessionsBody.appendChild(tr);
    });
  }

  /**
   * Ajoute une nouvelle séance au tableau interne.
   */
  function addSession(session) {
    sessions.push(session);
    saveSessions();
    updateTable();
  }

  // Soumission du formulaire
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    let athleteName;
    const storedName = localStorage.getItem('swimmerName');
    if (storedName) {
      athleteName = storedName;
    } else {
      athleteName = form.athleteName.value.trim();
    }

    const sessionDate = form.sessionDate.value;
    const duration = parseInt(form.duration.value, 10);
    const rpe = parseInt(form.rpe.value, 10);
    const performance = parseInt(form.performance.value, 10);
    const engagement = parseInt(form.engagement.value, 10);
    const fatigue = parseInt(form.fatigue.value, 10);
    const comments = form.comments.value.trim();

    // Enregistrer le nom si ce n'est pas déjà fait
    if (!storedName && athleteName) {
      localStorage.setItem('swimmerName', athleteName);
      loadStoredName();
    }

    if (!athleteName || !sessionDate || isNaN(duration) || isNaN(rpe)) {
      alert('Merci de remplir tous les champs obligatoires.');
      return;
    }

    const session = {
      athleteName,
      sessionDate,
      duration,
      rpe,
      performance,
      engagement,
      fatigue,
      comments
    };

    addSession(session);

    // Synchronisation distante
    syncSession(session);

    // Reset formulaire et refresh affichage sliders
    form.reset();
    setupRangeUpdates();
  });

  // Export CSV (secours)
  exportCsvBtn.addEventListener('click', () => {
    if (sessions.length === 0) {
      alert('Aucune séance à exporter.');
      return;
    }
    const headers = ['Nom', 'Date et heure', 'Durée (min)', 'RPE', 'Performance', 'Engagement', 'Fatigue', 'Charge', 'Commentaires'];
    const rows = sessions.map((s) => {
      const date = new Date(s.sessionDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
      const load = s.duration * s.rpe;
      return [
        s.athleteName,
        date,
        s.duration,
        s.rpe,
        s.performance,
        s.engagement,
        s.fatigue,
        load,
        s.comments ? s.comments.replace(/\n/g, ' ') : ''
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'suivi_nageurs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Export JSON (secours)
  exportJsonBtn.addEventListener('click', () => {
    if (sessions.length === 0) {
      alert('Aucune séance à exporter.');
      return;
    }
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'suivi_nageurs.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Clear data
  clearDataBtn.addEventListener('click', () => {
    if (!confirm('Voulez-vous vraiment supprimer toutes les données enregistrées ?')) return;
    sessions = [];
    saveSessions();
    updateTable();
  });

  // Init
  setupRangeUpdates();
  loadStoredName();

  if (changeNameBtn) {
    changeNameBtn.addEventListener('click', () => {
      localStorage.removeItem('swimmerName');
      loadStoredName();
    });
  }

  loadSessions();
});
