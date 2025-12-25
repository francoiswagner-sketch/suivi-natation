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
    // Récupération et nettoyage des données du formulaire
    const athleteName = form.athleteName.value.trim();
    const sessionDate = form.sessionDate.value;
    const duration = parseInt(form.duration.value, 10);
    const rpe = parseInt(form.rpe.value, 10);
    const performance = parseInt(form.performance.value, 10);
    const engagement = parseInt(form.engagement.value, 10);
    const fatigue = parseInt(form.fatigue.value, 10);
    const comments = form.comments.value.trim();
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
    // Réinitialiser le formulaire
    form.reset();
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

  // Initialisation des données au chargement
  loadSessions();
});