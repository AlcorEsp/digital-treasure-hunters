// Script principal para el popup de la extensión
document.addEventListener('DOMContentLoaded', async function() {
  // Referencias a elementos del DOM
  const userInfoEl = document.getElementById('user-info');
  const currentMissionEl = document.getElementById('current-mission');
  const teamMembersEl = document.getElementById('team-members');
  const discoveredCluesEl = document.getElementById('discovered-clues');
  const clueCountEl = document.getElementById('clue-count');
  const scanPageBtn = document.getElementById('scan-page');
  const settingsBtn = document.getElementById('settings-btn');
  const roleSelectionModal = document.getElementById('role-selection');
  const confirmRoleBtn = document.getElementById('confirm-role');
  const roleCards = document.querySelectorAll('.role-card');
  const viewAllMissionsBtn = document.getElementById('view-all-missions');
  const manageTeamsBtn = document.getElementById('manage-teams');
  const detachBtn = document.getElementById('detach-btn');

  // Referencias Modo Competitivo Alpha vs Beta
  const switchAlphaBtn = document.getElementById('switch-alpha-btn');
  const switchBetaBtn = document.getElementById('switch-beta-btn');
  const scoreAlphaEl = document.getElementById('score-alpha');
  const scoreBetaEl = document.getElementById('score-beta');
  const hideTargetBtn = document.getElementById('hide-target-btn');
  const verifyTargetBtn = document.getElementById('verify-target-btn');
  const rivalChallengeBox = document.getElementById('rival-challenge-box');

  // Gestores unificados
  const missionManager = new MissionManager();
  const teamManager = new TeamManager();

  // Estado local en el popup
  let currentRole = null;
  let currentTeamId = 'team-alpha';
  let currentTeamMembers = [];
  let discoveredClues = [];
  let currentMissionDetails = null;
  let userXp = 0;
  let challenges = [];
  let teamScores = { 'team-alpha': 0, 'team-beta': 0 };
  let showAllRoleClues = false;

  // Inicialización
  await initializeApp();
  // Intentar sincronizar retos en segundo plano desde forgeprojects.es
  chrome.runtime.sendMessage({ action: 'syncChallenges' }).then(res => {
    if (res && res.success) {
      challenges = res.challenges || challenges;
      teamScores = res.teamScores || teamScores;
      updateVersusUI();
    }
  }).catch(() => {});

  // Función de inicialización
  async function initializeApp() {
    await missionManager.init();
    await teamManager.init();

    const storageData = await chrome.storage.local.get([
      'user', 'role', 'clues', 'showRoleSelection', 'currentTeam', 'challenges', 'teamScores'
    ]);

    // Unificar lectura de rol, facción y pistas
    currentRole = (storageData.user && storageData.user.role) || storageData.role || null;
    currentTeamId = storageData.currentTeam || (storageData.user && storageData.user.team) || 'team-alpha';
    if (currentTeamId !== 'team-alpha' && currentTeamId !== 'team-beta') {
      currentTeamId = 'team-alpha';
    }

    userXp = (storageData.user && storageData.user.xp) || 0;
    discoveredClues = (storageData.user && storageData.user.discoveredClues && storageData.user.discoveredClues.length > 0)
      ? storageData.user.discoveredClues
      : (storageData.clues || []);

    challenges = storageData.challenges || [];
    teamScores = storageData.teamScores || { 'team-alpha': 0, 'team-beta': 0 };

    currentMissionDetails = missionManager.getCurrentMissionDetails();
    currentTeamMembers = teamManager.getTeamMembers() || [];

    // Comprobar si el usuario ya tiene un rol asignado y no pidió cambiarlo
    if (currentRole && !storageData.showRoleSelection) {
      updateUI();
    } else {
      if (storageData.showRoleSelection) {
        await chrome.storage.local.set({ showRoleSelection: false });
      }
      if (roleSelectionModal) {
        roleSelectionModal.classList.remove('hidden');
      }
      updateUI();
    }
  }

  // Obtener el reto activo que debemos buscar (plantado por el equipo contrario)
  function getActiveRivalChallenge() {
    const rivalTeamId = currentTeamId === 'team-alpha' ? 'team-beta' : 'team-alpha';
    return challenges.find(c => c.status === 'active' && c.teamId === rivalTeamId) ||
           challenges.find(c => c.status === 'active') || null;
  }

  // Actualizar el panel Alpha vs Beta
  function updateVersusUI() {
    if (scoreAlphaEl) scoreAlphaEl.textContent = teamScores['team-alpha'] || 0;
    if (scoreBetaEl) scoreBetaEl.textContent = teamScores['team-beta'] || 0;

    if (switchAlphaBtn && switchBetaBtn) {
      switchAlphaBtn.classList.toggle('active-faction', currentTeamId === 'team-alpha');
      switchBetaBtn.classList.toggle('active-faction', currentTeamId === 'team-beta');
    }

    if (!rivalChallengeBox) return;

    const activeChallenge = getActiveRivalChallenge();
    const myTeamLabel = currentTeamId === 'team-alpha' ? 'Equipo Alpha' : 'Equipo Beta';
    const rivalTeamLabel = currentTeamId === 'team-alpha' ? 'Equipo Beta' : 'Equipo Alpha';

    if (!activeChallenge) {
      if (verifyTargetBtn) verifyTargetBtn.disabled = true;
      rivalChallengeBox.innerHTML = `
        <div style="text-align: center; color: #555; padding: 6px 0;">
          <strong>Sin objetivos activos del ${rivalTeamLabel}.</strong>
          <p style="font-size: 0.78rem; margin-top: 4px;">Navega a cualquier rincón de Internet y pulsa <strong>"🎯 Esconder Objetivo aquí"</strong> para que la IA genere pistas para el equipo rival.</p>
        </div>
      `;
      return;
    }

    if (verifyTargetBtn) verifyTargetBtn.disabled = false;

    const creatorTeamLabel = activeChallenge.teamId === 'team-alpha' ? 'Equipo Alpha' : 'Equipo Beta';
    const isOwnTeamChallenge = activeChallenge.teamId === currentTeamId;
    const roleKey = currentRole || 'decoder';
    const myRoleClue = (activeChallenge.clues && activeChallenge.clues[roleKey]) || 'Escanea la red con tu equipo.';

    const allCluesHtml = showAllRoleClues && activeChallenge.clues
      ? Object.entries(activeChallenge.clues).map(([rKey, text]) => `
          <div class="ai-clue-card" style="margin-top: 4px;">
            <strong>${formatRoleIcon(rKey)} ${formatRoleName(rKey)}:</strong> ${text}
          </div>
        `).join('')
      : `
        <div class="ai-clue-card">
          <strong>Pista IA para tu rol (${formatRoleIcon(roleKey)} ${formatRoleName(roleKey)}):</strong><br>
          ${myRoleClue}
        </div>
      `;

    rivalChallengeBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; color: #1d3557;">
          ${isOwnTeamChallenge ? `📌 Reto plantado por tu ${creatorTeamLabel}` : `🔥 Objetivo oculto por ${creatorTeamLabel}`}
        </span>
        <a href="#" id="toggle-all-role-clues" class="section-link">${showAllRoleClues ? 'Ver mi rol' : 'Dossier (5 roles)'}</a>
      </div>
      ${activeChallenge.screenshot ? `<img src="${activeChallenge.screenshot}" class="challenge-preview-img" alt="Captura del objetivo">` : ''}
      ${allCluesHtml}
    `;

    const toggleLink = document.getElementById('toggle-all-role-clues');
    if (toggleLink) {
      toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAllRoleClues = !showAllRoleClues;
        updateVersusUI();
      });
    }
  }

  // Actualizar la interfaz con los datos actuales
  function updateUI() {
    updateVersusUI();

    // Actualizar la información del usuario
    if (userInfoEl) {
      if (currentRole) {
        userInfoEl.innerHTML = `
          <div class="user-role" title="Haz clic para cambiar de rol" style="cursor: pointer;">
            <span class="role-name">${formatRoleIcon(currentRole)} ${formatRoleName(currentRole)}</span>
            <span class="count-badge" style="margin-left: 6px;">${userXp} XP</span>
          </div>
        `;
        const userRoleBadge = userInfoEl.querySelector('.user-role');
        if (userRoleBadge) {
          userRoleBadge.addEventListener('click', () => {
            if (roleSelectionModal) {
              roleSelectionModal.classList.remove('hidden');
            }
          });
        }
      } else {
        userInfoEl.innerHTML = `<span class="role-name">Sin rol</span>`;
      }
    }

    // Actualizar la información de la misión actual
    if (currentMissionEl) {
      if (currentMissionDetails) {
        const nextPendingObj = currentMissionDetails.objectives.find(obj => {
          const objProg = currentMissionDetails.details && currentMissionDetails.details.objectives[obj.id];
          return !objProg || !objProg.completed;
        });

        currentMissionEl.innerHTML = `
          <h3>${currentMissionDetails.title}</h3>
          <p>${currentMissionDetails.description}</p>
          ${nextPendingObj ? `<p style="font-size: 0.85rem; color: #3c6e71; margin-top: 6px;"><strong>Objetivo actual:</strong> ${nextPendingObj.description}</p>` : ''}
          <div class="mission-progress" style="margin-top: 8px;">
            <div class="progress-bar" style="height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
              <div class="progress" style="width: ${currentMissionDetails.progress}%; height: 100%; background: #3c6e71;"></div>
            </div>
            <span class="progress-text" style="font-size: 0.8rem; color: #666;">${currentMissionDetails.progress}% completado (${currentMissionDetails.completedObjectives}/${currentMissionDetails.totalObjectives})</span>
          </div>
        `;
      } else {
        currentMissionEl.innerHTML = `
          <p class="no-mission">No hay misiones activas. Visita la sección de misiones para elegir una.</p>
        `;
      }
    }

    // Actualizar la lista de miembros del equipo
    if (teamMembersEl) {
      const currentTeam = teamManager.getCurrentTeam();
      if (currentTeam && currentTeamMembers.length > 0) {
        teamMembersEl.innerHTML = `
          <div style="font-size: 0.85rem; font-weight: bold; color: #284b63; margin-bottom: 6px;">${currentTeam.name}</div>
          ${currentTeamMembers.map(member => `
            <div class="team-member">
              <div class="avatar">${member.name.charAt(0)}</div>
              <div class="member-info">
                <div class="member-name">${member.name}</div>
              </div>
              <div class="role-badge">${formatRoleName(member.role)}</div>
            </div>
          `).join('')}
        `;
      } else {
        teamMembersEl.innerHTML = `<p class="no-team">Facción activa: <strong>${currentTeamId === 'team-alpha' ? 'Equipo Alpha' : 'Equipo Beta'}</strong>. Entra en Gestionar para ver el escuadrón.</p>`;
      }
    }

    // Actualizar la lista de pistas descubiertas
    if (discoveredCluesEl) {
      if (discoveredClues.length > 0) {
        discoveredCluesEl.innerHTML = discoveredClues.slice(0, 3).map(clue => `
          <div class="clue-item">
            <div class="clue-content">${clue.content}</div>
            <div class="clue-source">Encontrado en: ${formatSourceUrl(clue.source)}</div>
            <div class="clue-date" style="font-size: 0.75rem; color: #999;">Descubierto: ${new Date(clue.timestamp || clue.discoveredAt || Date.now()).toLocaleString()}</div>
          </div>
        `).join('');

        if (discoveredClues.length > 3) {
          discoveredCluesEl.innerHTML += `
            <div class="see-more-clues" style="text-align: center; margin-top: 8px;">
              <a href="#" id="see-all-clues" class="section-link">Ver todas las pistas (${discoveredClues.length})</a>
            </div>
          `;

          setTimeout(() => {
            const seeAllCluesBtn = document.getElementById('see-all-clues');
            if (seeAllCluesBtn) {
              seeAllCluesBtn.addEventListener('click', showAllClues);
            }
          }, 0);
        }

        if (clueCountEl) {
          clueCountEl.textContent = discoveredClues.length;
        }
      } else {
        discoveredCluesEl.innerHTML = `<p class="no-clues">Aún no se han encontrado pistas. ¡Escanea una página web para empezar!</p>`;
        if (clueCountEl) {
          clueCountEl.textContent = '0';
        }
      }
    }
  }

  function formatSourceUrl(url) {
    if (!url) return 'Página web';
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  }

  function formatRoleIcon(role) {
    const icons = {
      'decoder': '🔎',
      'translator': '🌐',
      'visual-analyst': '👁️',
      'historian': '📚',
      'navigator': '🧭'
    };
    return icons[role] || '🕵️';
  }

  function formatRoleName(role) {
    if (!role) return 'Sin rol';

    const roleNames = {
      'decoder': 'Decodificador',
      'translator': 'Traductor',
      'visual-analyst': 'Analista Visual',
      'historian': 'Historiador',
      'navigator': 'Navegador'
    };

    return roleNames[role] || role;
  }

  // Cambiar facción Alpha / Beta rápidamente
  async function selectFaction(teamId) {
    currentTeamId = teamId;
    await teamManager.joinTeam(teamId);
    await chrome.runtime.sendMessage({ action: 'joinTeam', teamId });
    await initializeApp();
  }

  if (switchAlphaBtn) {
    switchAlphaBtn.addEventListener('click', () => selectFaction('team-alpha'));
  }
  if (switchBetaBtn) {
    switchBetaBtn.addEventListener('click', () => selectFaction('team-beta'));
  }

  // Asegurar que content.js esté inyectado en la pestaña activa
  async function sendToActiveTab(payload) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.url || !activeTab.url.startsWith('http')) {
      alert('Abre cualquier página web (http/https) para usar esta acción.');
      return null;
    }
    try {
      return await chrome.tabs.sendMessage(activeTab.id, payload);
    } catch (err) {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: activeTab.id },
        files: ['content.css']
      }).catch(() => {});
      return await chrome.tabs.sendMessage(activeTab.id, payload);
    }
  }

  // Botón: Esconder Objetivo en la página actual
  if (hideTargetBtn) {
    hideTargetBtn.addEventListener('click', async function() {
      const res = await sendToActiveTab({
        action: 'startCaptureTarget',
        team: currentTeamId
      });
      if (res && res.success) {
        window.close(); // Cerrar el popup para que el jugador haga clic cómodamente en la página
      }
    });
  }

  // Botón: Verificar / Reclamar Objetivo del equipo rival en la página actual
  if (verifyTargetBtn) {
    verifyTargetBtn.addEventListener('click', async function() {
      const activeChallenge = getActiveRivalChallenge();
      if (!activeChallenge) {
        alert('No hay ningún objetivo activo para verificar.');
        return;
      }
      const res = await sendToActiveTab({
        action: 'startVerifyTarget',
        challenge: activeChallenge
      });
      if (res && res.success) {
        window.close(); // Cerrar el popup para que el jugador haga clic en el elemento de la página
      }
    });
  }

  // Escanear la página actual
  if (scanPageBtn) {
    scanPageBtn.addEventListener('click', async function() {
      if (!currentRole) {
        if (roleSelectionModal) roleSelectionModal.classList.remove('hidden');
        return;
      }

      try {
        scanPageBtn.disabled = true;
        scanPageBtn.textContent = 'Escaneando...';

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await sendToActiveTab({ action: 'scanPage', role: currentRole });

        if (response && response.clues && response.clues.length > 0) {
          await chrome.runtime.sendMessage({
            action: 'cluesBatchDiscovered',
            clues: response.clues,
            currentUrl: activeTab.url
          });

          await initializeApp();
          alert(`¡Escaneo completado! Se detectaron ${response.clues.length} pistas en esta página.`);
        } else if (response) {
          alert('No se han encontrado pistas para tu rol (' + formatRoleName(currentRole) + ') en esta página. Prueba en otra web o cambia de rol.');
        }
      } catch (error) {
        console.error('Error al escanear la página:', error);
      } finally {
        scanPageBtn.disabled = false;
        scanPageBtn.textContent = 'Escanear esta página';
      }
    });
  }

  // Selección de rol
  if (roleCards && roleCards.length > 0) {
    roleCards.forEach(card => {
      card.addEventListener('click', function() {
        roleCards.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        currentRole = this.dataset.role;
      });
    });
  }

  // Confirmar la selección de rol
  if (confirmRoleBtn) {
    confirmRoleBtn.addEventListener('click', async function() {
      if (currentRole) {
        await chrome.runtime.sendMessage({ action: 'roleSelected', role: currentRole });

        if (roleSelectionModal) {
          roleSelectionModal.classList.add('hidden');
        }

        await initializeApp();
      } else {
        alert('Por favor, selecciona un rol para continuar.');
      }
    });
  }

  // Botón de Portal Web / Control de Mando en ForgeProjects
  if (settingsBtn) {
    settingsBtn.textContent = 'Control de Mando';
    settingsBtn.title = 'Abrir Control de Mando en forgeprojects.es';
    settingsBtn.addEventListener('click', function() {
      chrome.tabs.create({ url: 'https://www.forgeprojects.es/digital-treasure-hunters/' });
    });
  }

  // Botón para mantener el popup abierto
  if (detachBtn) {
    detachBtn.addEventListener('click', function() {
      const popupUrl = chrome.runtime.getURL('popup.html');

      chrome.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 480,
        height: 650,
        focused: true
      });

      window.close();
    });
  }

  // Función para mostrar todas las pistas
  function showAllClues(e) {
    if (e) e.preventDefault();
    discoveredCluesEl.innerHTML = discoveredClues.map(clue => `
      <div class="clue-item">
        <div class="clue-content">${clue.content}</div>
        <div class="clue-source">Encontrado en: ${formatSourceUrl(clue.source)}</div>
        <div class="clue-date" style="font-size: 0.75rem; color: #999;">Descubierto: ${new Date(clue.timestamp || clue.discoveredAt || Date.now()).toLocaleString()}</div>
      </div>
    `).join('');
  }

  function navigateToMissions(e) {
    if (e) e.preventDefault();
    window.location.href = chrome.runtime.getURL('missions.html');
  }

  async function navigateToTeams(e) {
    if (e) e.preventDefault();
    await chrome.runtime.sendMessage({ action: 'teamPageVisited' }).catch(() => {});
    window.location.href = chrome.runtime.getURL('teams.html');
  }

  if (viewAllMissionsBtn) {
    viewAllMissionsBtn.addEventListener('click', navigateToMissions);
  }

  if (manageTeamsBtn) {
    manageTeamsBtn.addEventListener('click', navigateToTeams);
  }

  const isDetached = window.outerHeight > 600;
  const closeWindowBtn = document.getElementById('close-window-btn');

  if (isDetached && closeWindowBtn) {
    closeWindowBtn.style.display = 'flex';
    closeWindowBtn.addEventListener('click', function() {
      window.close();
    });
  }
});
