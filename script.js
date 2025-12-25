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
  const submitBtn = document.getElementById('submit-btn');
  const syncStatus = document.getElementById('sync-status');

  // Gestion du nom du nageur : zones de saisie et d'affichage
  const athleteNameWrapper = document.getElementById('athleteNameWrapper');
  const storedNameDisplay = document.getElementById('storedNameDisplay');
  const storedNameEl = document.getElementById('storedName');
  const changeNameBtn = document.getElementById('changeName');

  // Les champs de saisie (durée, RPE, etc.) sont des listes déroulantes (select)
  // pour limiter l'usage du clavier et guider le nageur avec des libellés.

  // Point d'API pour la synchronisation automatique (Google Apps Script Web App)
  // IMPORTANT : le token doit correspondre à SHARED_TOKEN dans Apps Script.
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
   * Charge et affiche le nom du nageur depuis le localStorage. Si un nom est
   * stocké, l'input de saisie est masqué et remplacé par un affichage
   * en lecture seule avec un bouton pour changer le nom.
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

  function setStatus(message, kind) {
    if (!syncStatus) return;
    syncStatus.textContent = message || '';
    syncStatus.classList.remove('ok', 'err');
    if (kind) syncStatus.classList.add(kind);
  }

  /**
   * Envoie la séance à un service distant si un point de synchronisation est
   * défini. Cette fonction utilise fetch pour effectuer un POST vers
   * SYNC_ENDPOINT avec les données de la séance. En cas d'échec,
   * l'erreur est simplement journalisée sans bloquer l'enregistrement local.
   * @param {Object} session Les données de la séance à synchroniser
   */
  async function syncSession(session) {
    if (!SYNC_ENDPOINT) {
      return;
    }
    // Apps Script Web App : envoyer le JSON en *texte* pour éviter le preflight CORS
    // et suivre les redirections (Apps Script renvoie souvent un 302).
    try {
      const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        ...session,
        userAgent: navigator.userAgent
      })
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} — ${text}`);
      }
      if (text.trim() !== 'OK') {
        throw new Error(text.trim() || 'Réponse inattendue');
      }
      setStatus('✅ Séance enregistrée et envoyée au coach', 'ok');
    } catch (error) {
      console.error('Erreur lors de la synchronisation :', error);
      setStatus('⚠️ Séance enregistrée sur le téléphone, mais envoi au coach impossible (réseau / token / droits).', 'err');
    }
  }

  /**
   * Met à jour l'affichage du tableau des séances. Affiche ou masque
   * le tableau et le message d'absence de données selon le cas.
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
      // Définit les labels pour chaque colonne afin de faciliter l'affichage sur mobile
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
      // Nom
      const nameCell = document.createElement('td');
      nameCell.textContent = session.athleteName;
      nameCell.setAttribute('data-label', labels[0]);
      tr.appendChild(nameCell);
      // Date et heure (format local lisible)
      const dateCell = document.createElement('td');
      let dateStr;
      try {
        const date = new Date(session.sessionDate);
        dateStr = date.toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short'
        });
      } catch (e) {
        dateStr = session.sessionDate;
      }
      dateCell.textContent = dateStr;
      dateCell.setAttribute('data-label', labels[1]);
      tr.appendChild(dateCell);
      // Durée
      const durationCell = document.createElement('td');
      durationCell.textContent = session.duration;
      durationCell.setAttribute('data-label', labels[2]);
      tr.appendChild(durationCell);
      // RPE
      const rpeCell = document.createElement('td');
      rpeCell.textContent = session.rpe;
      rpeCell.setAttribute('data-label', labels[3]);
      tr.appendChild(rpeCell);
      // Performance perçue
      const perfCell = document.createElement('td');
      perfCell.textContent = session.performance;
      perfCell.setAttribute('data-label', labels[4]);
      tr.appendChild(perfCell);
      // Engagement
      const engagementCell = document.createElement('td');
      engagementCell.textContent = session.engagement;
      engagementCell.setAttribute('data-label', labels[5]);
      tr.appendChild(engagementCell);
      // Fatigue
      const fatigueCell = document.createElement('td');
      fatigueCell.textContent = session.fatigue;
      fatigueCell.setAttribute('data-label', labels[6]);
      tr.appendChild(fatigueCell);
      // Charge d'entraînement (Durée x RPE)
      const loadCell = document.createElement('td');
      const load = session.duration * session.rpe;
      loadCell.textContent = load;
      loadCell.setAttribute('data-label', labels[7]);
      tr.appendChild(loadCell);
      // Commentaires
      const commentsCell = document.createElement('td');
      commentsCell.textContent = session.comments || '';
      commentsCell.setAttribute('data-label', labels[8]);
      tr.appendChild(commentsCell);
      sessionsBody.appendChild(tr);
    });
  }

  /**
   * Ajoute une nouvelle séance au tableau interne, puis sauvegarde
   * et met à jour l'affichage.
   * @param {Object} session Un objet contenant les données de la séance
   */
  function addSession(session) {
    sessions.push(session);
    saveSessions();
    updateTable();
  }

  // Gestion de la soumission du formulaire
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    setStatus('', null);
    // Récupération et nettoyage des données du formulaire
    let athleteName;
    const storedName = localStorage.getItem('swimmerName');
    if (storedName) {
      athleteName = storedName;
    } else {
      athleteName = form.athleteName.value.trim();
    }
    const sessionDate = form.sessionDate.value;
    const timeSlot = form.timeSlot ? form.timeSlot.value : '';
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
    if (!athleteName || !sessionDate || !timeSlot || isNaN(duration) || isNaN(rpe)) {
      // Affiche les erreurs natives si possible
      if (typeof form.reportValidity === 'function') form.reportValidity();
      setStatus('Merci de remplir tous les champs obligatoires.', 'err');
      return;
    }

    const sessionDateLabel = `${sessionDate} (${timeSlot})`;
    const session = {
      athleteName,
      sessionDate: sessionDateLabel,
      duration,
      rpe,
      performance,
      engagement,
      fatigue,
      comments
    };
    addSession(session);

    // Feedback immédiat côté utilisateur
    if (submitBtn) submitBtn.disabled = true;
    setStatus('Enregistrement…', null);

    // Synchronisation distante si un endpoint est configuré
    syncSession(session).finally(() => {
      if (submitBtn) submitBtn.disabled = false;
    });
    // Réinitialiser le formulaire (sauf le nom si enregistré)
    form.reset();

    // Remettre la date à aujourd'hui pour éviter une saisie manuelle
    if (form.sessionDate) {
      form.sessionDate.valueAsDate = new Date();
    }
  });

  /**
   * Transforme les données en chaîne CSV et déclenche un téléchargement.
   */
  exportCsvBtn.addEventListener('click', () => {
    if (sessions.length === 0) {
      alert('Aucune séance à exporter.');
      return;
    }
    // Définition de l'en-tête du CSV
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

  /**
   * Transforme les données en JSON et déclenche un téléchargement.
   */
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

  /**
   * Supprime toutes les séances après confirmation de l'utilisateur.
   */
  clearDataBtn.addEventListener('click', () => {
    if (!confirm('Voulez‑vous vraiment supprimer toutes les données enregistrées ?')) {
      return;
    }
    sessions = [];
    saveSessions();
    updateTable();
  });

  // Chargement du nom enregistré
  loadStoredName();

  // Valeur par défaut : date du jour
  if (form.sessionDate) {
    form.sessionDate.valueAsDate = new Date();
  }
  // Permettre à l'utilisateur de changer son nom enregistré
  if (changeNameBtn) {
    changeNameBtn.addEventListener('click', () => {
      localStorage.removeItem('swimmerName');
      loadStoredName();
    });
  }

  // Initialisation des données au chargement
  loadSessions();
});
