// Script principal para el popup de la extensión
document.addEventListener('DOMContentLoaded', function() {
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

  // Variables globales
  let currentRole = null;
  let currentTeam = [];
  let discoveredClues = [];
  let currentMission = null;

  // Inicialización
  initializeApp();

  // Función de inicialización
  async function initializeApp() {
    const userData = await chrome.storage.local.get(['role', 'team', 'clues', 'mission']);
    
    // Comprobar si el usuario ya tiene un rol asignado
    if (userData.role) {
      currentRole = userData.role;
      currentTeam = userData.team || [];
      discoveredClues = userData.clues || [];
      currentMission = userData.mission;
      
      // Actualizar la interfaz con los datos guardados
      updateUI();
    } else {
      // Si el usuario no tiene un rol, mostrar el modal de selección
      if (roleSelectionModal) {
        roleSelectionModal.classList.remove('hidden');
      }
    }
  }

  // Actualizar la interfaz con los datos actuales
  function updateUI() {
    // Actualizar la información del usuario
    if (userInfoEl) {
      userInfoEl.innerHTML = `
        <div class="user-role">
          <span class="role-icon ${currentRole}"></span>
          <span class="role-name">${formatRoleName(currentRole)}</span>
        </div>
      `;
    }
    
    // Actualizar la información de la misión actual
    if (currentMissionEl) {
      if (currentMission) {
        currentMissionEl.innerHTML = `
          <h3>${currentMission.title}</h3>
          <p>${currentMission.description}</p>
          <div class="mission-progress">
            <div class="progress-bar">
              <div class="progress" style="width: ${currentMission.progress}%"></div>
            </div>
            <span class="progress-text">${currentMission.progress}% completado</span>
          </div>
        `;
      } else {
        currentMissionEl.innerHTML = `
          <p class="no-mission">No hay misiones activas. Visita la sección de misiones para comenzar.</p>
        `;
      }
    }
    
    // Actualizar la lista de miembros del equipo
    if (teamMembersEl) {
      if (currentTeam.length > 0) {
        teamMembersEl.innerHTML = currentTeam.map(member => `
          <div class="team-member">
            <div class="avatar">${member.name.charAt(0)}</div>
            <div class="member-info">
              <div class="member-name">${member.name}</div>
            </div>
            <div class="role-badge">${formatRoleName(member.role)}</div>
          </div>
        `).join('');
      } else {
        teamMembersEl.innerHTML = `<p class="no-team">No perteneces a ningún equipo todavía.</p>`;
      }
    }
    
    // Actualizar la lista de pistas descubiertas
    if (discoveredCluesEl) {
      if (discoveredClues.length > 0) {
        discoveredCluesEl.innerHTML = discoveredClues.slice(0, 3).map(clue => `
          <div class="clue-item">
            <div class="clue-content">${clue.content}</div>
            <div class="clue-source">Encontrado en: ${clue.source}</div>
            <div class="clue-date">Descubierto: ${new Date(clue.timestamp).toLocaleString()}</div>
          </div>
        `).join('');
        
        if (discoveredClues.length > 3) {
          discoveredCluesEl.innerHTML += `
            <div class="see-more-clues">
              <a href="#" id="see-all-clues">Ver todas las pistas (${discoveredClues.length})</a>
            </div>
          `;
          
          // Añadir event listener para ver todas las pistas
          setTimeout(() => {
            const seeAllCluesBtn = document.getElementById('see-all-clues');
            if (seeAllCluesBtn) {
              seeAllCluesBtn.addEventListener('click', showAllClues);
            }
          }, 0);
        }
        
        // Actualizar contador de pistas
        if (clueCountEl) {
          clueCountEl.textContent = discoveredClues.length;
        }
      } else {
        discoveredCluesEl.innerHTML = `<p class="no-clues">Aún no se han encontrado pistas.</p>`;
        
        // Actualizar contador de pistas
        if (clueCountEl) {
          clueCountEl.textContent = '0';
        }
      }
    }
  }

  // Formatear el nombre del rol para mostrar
  function formatRoleName(role) {
    if (!role) return '';
    
    const roleNames = {
      'decoder': 'Decodificador',
      'translator': 'Traductor',
      'visual-analyst': 'Analista Visual',
      'historian': 'Historiador',
      'navigator': 'Navegador'
    };
    
    return roleNames[role] || role;
  }

  // Event Listeners
  
  // Escanear la página actual
  if (scanPageBtn) {
    scanPageBtn.addEventListener('click', async function() {
      try {
        // Obtener la pestaña activa
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Enviar mensaje al content script para escanear la página
        chrome.tabs.sendMessage(activeTab.id, { action: 'scanPage', role: currentRole }, function(response) {
          if (response && response.clues && response.clues.length > 0) {
            // Añadir nuevas pistas al array
            discoveredClues = [...discoveredClues, ...response.clues];
            
            // Guardar las pistas actualizadas
            chrome.storage.local.set({ clues: discoveredClues });
            
            // Actualizar la interfaz con las nuevas pistas
            updateUI();
            
            // Notificar al usuario
            alert(`¡Se han encontrado ${response.clues.length} nuevas pistas!`);
          } else {
            alert('No se han encontrado pistas en esta página.');
          }
        });
      } catch (error) {
        console.error('Error al escanear la página:', error);
        alert('Ha ocurrido un error al escanear la página.');
      }
    });
  }

  // Selección de rol
  if (roleCards && roleCards.length > 0) {
    roleCards.forEach(card => {
      card.addEventListener('click', function() {
        // Eliminar la clase seleccionada de todas las tarjetas
        roleCards.forEach(c => c.classList.remove('selected'));
        
        // Añadir la clase seleccionada a la tarjeta actual
        this.classList.add('selected');
        
        // Guardar el rol seleccionado
        currentRole = this.dataset.role;
      });
    });
  }

  // Confirmar la selección de rol
  if (confirmRoleBtn) {
    confirmRoleBtn.addEventListener('click', function() {
      if (currentRole) {
        // Guardar el rol seleccionado
        chrome.storage.local.set({ role: currentRole });
        
        // Ocultar el modal
        if (roleSelectionModal) {
          roleSelectionModal.classList.add('hidden');
        }
        
        // Actualizar la interfaz
        updateUI();
        
        // Notificar al background script que se ha seleccionado un rol
        chrome.runtime.sendMessage({ action: 'roleSelected', role: currentRole });
      } else {
        alert('Por favor, selecciona un rol para continuar.');
      }
    });
  }

  // Botón de ajustes
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      // Aquí se implementará la lógica para abrir el panel de ajustes
      alert('Panel de ajustes (próximamente)');
    });
  }
  
  // Botón para mantener el popup abierto
  if (detachBtn) {
    detachBtn.addEventListener('click', function() {
      // Abre una ventana emergente con el contenido del popup
      const popupUrl = chrome.runtime.getURL('popup.html');
      
      chrome.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 480,
        height: 650,
        focused: true
      });
      
      // Cerrar el popup actual
      window.close();
    });
  }

  // Función para mostrar todas las pistas
  function showAllClues(e) {
    if (e) e.preventDefault();
    // En una implementación real, aquí se mostraría un modal o página con todas las pistas
    alert('Próximamente: Vista de todas las pistas encontradas');
  }
  
  // Manejar navegación a la página de misiones
  function navigateToMissions(e) {
    if (e) e.preventDefault();
    window.location.href = chrome.runtime.getURL('missions.html');
  }
  
  // Manejar navegación a la página de equipos
  function navigateToTeams(e) {
    if (e) e.preventDefault();
    window.location.href = chrome.runtime.getURL('teams.html');
  }
  
  // Registrar listeners de navegación
  if (viewAllMissionsBtn) {
    viewAllMissionsBtn.addEventListener('click', navigateToMissions);
  }
  
  if (manageTeamsBtn) {
    manageTeamsBtn.addEventListener('click', navigateToTeams);
  }

  // Detectar si estamos en modo ventana independiente
  const isDetached = window.outerHeight > 600;
  const closeWindowBtn = document.getElementById('close-window-btn');
  
  if (isDetached && closeWindowBtn) {
    closeWindowBtn.style.display = 'flex';
    closeWindowBtn.addEventListener('click', function() {
      window.close();
    });
  }
});
