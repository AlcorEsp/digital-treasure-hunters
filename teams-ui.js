// Lógica de interfaz para la gestión de equipos
document.addEventListener('DOMContentLoaded', async function() {
  // Inicializar el gestor de equipos
  const teamManager = new TeamManager();
  await teamManager.init();
  
  // Referencias a elementos del DOM
  const currentTeamEl = document.getElementById('current-team');
  const teamMembersEl = document.getElementById('team-members');
  const availableTeamsEl = document.getElementById('available-teams');
  const pendingInvitationsEl = document.getElementById('pending-invitations');
  const createTeamFormEl = document.getElementById('create-team-form');
  const inviteBtn = document.getElementById('invite-btn');
  const shareCluesBtn = document.getElementById('share-clues-btn');
  const backBtn = document.getElementById('back-btn');
  
  // Referencias para el modal de invitación
  const inviteModal = document.getElementById('invite-modal');
  const inviteCodeInput = document.getElementById('invite-code');
  const copyInviteCodeBtn = document.getElementById('copy-invite-code');
  const joinCodeInput = document.getElementById('join-code');
  const joinTeamBtn = document.getElementById('join-team-btn');
  const closeInviteModalBtn = document.getElementById('close-invite-modal');
  
  // Inicializar la interfaz
  initializeUI();
  
  // Función para inicializar la interfaz
  async function initializeUI() {
    try {
      // Cargar datos del equipo actual
      updateCurrentTeamUI();
      
      // Cargar miembros del equipo
      updateTeamMembersUI();
      
      // Cargar equipos disponibles
      updateAvailableTeamsUI();
      
      // Cargar invitaciones pendientes
      updatePendingInvitationsUI();
      
      // Comprobar si el usuario es líder del equipo para habilitar/deshabilitar botones
      const isLeader = await teamManager.isTeamLeader();
      inviteBtn.disabled = !isLeader;
      
      if (!teamManager.getCurrentTeam()) {
        // Si no hay equipo actual, deshabilitar botones relacionados
        shareCluesBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error al inicializar UI:', error);
      showError('Error al cargar datos de equipos. Por favor, inténtalo de nuevo.');
    }
  }
  
  // Función para actualizar la UI del equipo actual
  function updateCurrentTeamUI() {
    const currentTeam = teamManager.getCurrentTeam();
    
    if (!currentTeam) {
      currentTeamEl.innerHTML = `
        <div class="no-team">
          <p>No perteneces a ningún equipo actualmente.</p>
          <p>Crea un nuevo equipo o únete a uno existente.</p>
        </div>
      `;
      return;
    }
    
    currentTeamEl.innerHTML = `
      <div class="team-card">
        <h3>${currentTeam.name} <span class="current-team-badge">Tu equipo actual</span></h3>
        <p>${currentTeam.description || 'Sin descripción'}</p>
        <div class="team-meta">
          <span>Creado: ${formatDate(currentTeam.createdAt)}</span>
          <span>${currentTeam.members.length} miembros</span>
        </div>
        <div class="team-actions">
          <button class="secondary-btn leave-team-btn" data-team-id="${currentTeam.id}">Abandonar equipo</button>
        </div>
      </div>
    `;
    
    // Añadir event listener para el botón de abandonar equipo
    const leaveTeamBtn = currentTeamEl.querySelector('.leave-team-btn');
    if (leaveTeamBtn) {
      leaveTeamBtn.addEventListener('click', handleLeaveTeam);
    }
  }
  
  // Función para actualizar la UI de miembros del equipo
  function updateTeamMembersUI() {
    const members = teamManager.getTeamMembers();
    
    if (!members || members.length === 0) {
      teamMembersEl.innerHTML = `
        <div class="no-members">
          <p>No hay miembros en este equipo.</p>
        </div>
      `;
      return;
    }
    
    teamMembersEl.innerHTML = `
      <div class="member-list">
        ${members.map(member => `
          <div class="member-item">
            <div class="member-avatar">${member.name.charAt(0)}</div>
            <div class="member-info">
              <div class="member-name">${member.name}</div>
              <div class="member-role">${formatRoleName(member.role)}</div>
            </div>
            ${member.isLeader ? '<span class="member-status leader-badge">Líder</span>' : ''}
            <span class="member-status ${Math.random() > 0.5 ? 'online-badge' : 'offline-badge'}">
              ${Math.random() > 0.5 ? 'Online' : 'Offline'}
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Función para actualizar la UI de equipos disponibles
  function updateAvailableTeamsUI() {
    const teams = teamManager.getAvailableTeams();
    const currentTeamId = teamManager.currentTeam;
    
    if (!teams || teams.length === 0) {
      availableTeamsEl.innerHTML = `
        <div class="no-team">
          <p>No hay equipos disponibles actualmente.</p>
          <p>¡Crea el primer equipo!</p>
        </div>
      `;
      return;
    }
    
    availableTeamsEl.innerHTML = `
      <div class="teams-list">
        ${teams.filter(team => team.id !== currentTeamId).map(team => `
          <div class="team-card">
            <h3>${team.name}</h3>
            <p>${team.description || 'Sin descripción'}</p>
            <div class="team-meta">
              <span>Creado: ${formatDate(team.createdAt)}</span>
              <span>${team.members.length} miembros</span>
            </div>
            <div class="team-actions">
              <button class="primary-btn join-team-btn" data-team-id="${team.id}">Unirse</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Añadir event listeners para los botones de unirse
    const joinTeamBtns = availableTeamsEl.querySelectorAll('.join-team-btn');
    joinTeamBtns.forEach(btn => {
      btn.addEventListener('click', handleJoinTeam);
    });
  }
  
  // Función para actualizar la UI de invitaciones pendientes
  function updatePendingInvitationsUI() {
    const invitations = teamManager.pendingInvitations;
    
    if (!invitations || invitations.length === 0) {
      pendingInvitationsEl.innerHTML = `
        <p class="no-invitations">No tienes invitaciones pendientes.</p>
      `;
      return;
    }
    
    pendingInvitationsEl.innerHTML = `
      <div class="invitations-list">
        ${invitations.map(inv => `
          <div class="invitation-card">
            <div class="invitation-info">
              <p><strong>${inv.invitedBy.name}</strong> te ha invitado a unirte a un equipo</p>
              <p class="invitation-date">Recibido: ${formatDate(inv.invitedAt)}</p>
            </div>
            <div class="invitation-actions">
              <button class="primary-btn accept-invitation-btn" data-team-id="${inv.teamId}">Aceptar</button>
              <button class="secondary-btn reject-invitation-btn" data-team-id="${inv.teamId}">Rechazar</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Añadir event listeners para los botones de invitaciones
    const acceptBtns = pendingInvitationsEl.querySelectorAll('.accept-invitation-btn');
    const rejectBtns = pendingInvitationsEl.querySelectorAll('.reject-invitation-btn');
    
    acceptBtns.forEach(btn => {
      btn.addEventListener('click', handleAcceptInvitation);
    });
    
    rejectBtns.forEach(btn => {
      btn.addEventListener('click', handleRejectInvitation);
    });
  }
  
  // Event Handlers
  
  // Manejar creación de nuevo equipo
  async function handleCreateTeam(e) {
    e.preventDefault();
    
    const teamNameInput = document.getElementById('team-name');
    const teamDescriptionInput = document.getElementById('team-description');
    
    const teamName = teamNameInput.value.trim();
    const teamDescription = teamDescriptionInput.value.trim();
    
    if (!teamName) {
      showError('Por favor, introduce un nombre para el equipo.');
      return;
    }
    
    try {
      const newTeam = await teamManager.createTeam(teamName, teamDescription);
      
      if (newTeam) {
        showSuccess('¡Equipo creado con éxito!');
        teamNameInput.value = '';
        teamDescriptionInput.value = '';
        
        // Actualizar la interfaz
        initializeUI();
      } else {
        showError('Hubo un problema al crear el equipo. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error al crear equipo:', error);
      showError('Error al crear equipo: ' + error.message);
    }
  }
  
  // Manejar unirse a un equipo
  async function handleJoinTeam(e) {
    const teamId = e.target.dataset.teamId;
    
    if (!teamId) {
      showError('ID de equipo no válido.');
      return;
    }
    
    try {
      const team = await teamManager.joinTeam(teamId);
      
      if (team) {
        showSuccess(`¡Te has unido al equipo "${team.name}"!`);
        
        // Actualizar la interfaz
        initializeUI();
      } else {
        showError('Hubo un problema al unirse al equipo. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error al unirse al equipo:', error);
      showError('Error al unirse al equipo: ' + error.message);
    }
  }
  
  // Manejar abandono de equipo
  async function handleLeaveTeam(e) {
    const teamId = e.target.dataset.teamId;
    
    if (!confirm('¿Estás seguro de que quieres abandonar este equipo?')) {
      return;
    }
    
    // En una implementación real, aquí estaría la lógica para abandonar el equipo
    // Por ahora, simplemente simulamos la acción
    
    try {
      // Simular abandono exitoso
      teamManager.currentTeam = null;
      teamManager.teamMembers = [];
      
      await chrome.storage.local.set({
        currentTeam: null,
        teamMembers: []
      });
      
      showSuccess('Has abandonado el equipo.');
      
      // Actualizar la interfaz
      initializeUI();
    } catch (error) {
      console.error('Error al abandonar equipo:', error);
      showError('Error al abandonar equipo: ' + error.message);
    }
  }
  
  // Manejar invitación a equipo
  function handleOpenInviteModal() {
    // Generar un código de invitación (en una implementación real sería más complejo)
    const inviteCode = generateInviteCode();
    inviteCodeInput.value = inviteCode;
    
    // Mostrar el modal
    inviteModal.classList.remove('hidden');
  }
  
  // Manejar cierre del modal de invitación
  function handleCloseInviteModal() {
    inviteModal.classList.add('hidden');
    joinCodeInput.value = '';
  }
  
  // Manejar copia de código de invitación
  function handleCopyInviteCode() {
    inviteCodeInput.select();
    document.execCommand('copy');
    
    // Cambiar temporalmente el texto del botón para indicar éxito
    const originalText = copyInviteCodeBtn.textContent;
    copyInviteCodeBtn.textContent = '¡Copiado!';
    setTimeout(() => {
      copyInviteCodeBtn.textContent = originalText;
    }, 2000);
  }
  
  // Manejar unirse mediante código
  async function handleJoinWithCode() {
    const code = joinCodeInput.value.trim();
    
    if (!code) {
      showError('Por favor, introduce un código de invitación.');
      return;
    }
    
    try {
      // En una implementación real, aquí se verificaría el código
      // Por ahora, simulamos unirse a un equipo aleatorio
      
      const teams = teamManager.getAvailableTeams();
      if (teams.length > 0) {
        const randomTeam = teams[Math.floor(Math.random() * teams.length)];
        const result = await teamManager.joinTeam(randomTeam.id);
        
        if (result) {
          showSuccess(`¡Te has unido al equipo "${randomTeam.name}"!`);
          handleCloseInviteModal();
          initializeUI();
        } else {
          showError('Código de invitación no válido o expirado.');
        }
      } else {
        showError('No hay equipos disponibles para unirse.');
      }
    } catch (error) {
      console.error('Error al unirse con código:', error);
      showError('Error al unirse con código: ' + error.message);
    }
  }
  
  // Manejar aceptación de invitación
  async function handleAcceptInvitation(e) {
    const teamId = e.target.dataset.teamId;
    
    try {
      // En una implementación real, aquí se aceptaría la invitación
      // Por ahora, simplemente simulamos unirse al equipo
      
      const team = await teamManager.joinTeam(teamId);
      
      if (team) {
        // Eliminar la invitación aceptada
        teamManager.pendingInvitations = teamManager.pendingInvitations.filter(
          inv => inv.teamId !== teamId
        );
        
        await chrome.storage.local.set({
          pendingInvitations: teamManager.pendingInvitations
        });
        
        showSuccess(`¡Has aceptado la invitación para unirte a "${team.name}"!`);
        initializeUI();
      } else {
        showError('Hubo un problema al aceptar la invitación.');
      }
    } catch (error) {
      console.error('Error al aceptar invitación:', error);
      showError('Error al aceptar invitación: ' + error.message);
    }
  }
  
  // Manejar rechazo de invitación
  async function handleRejectInvitation(e) {
    const teamId = e.target.dataset.teamId;
    
    try {
      // Eliminar la invitación rechazada
      teamManager.pendingInvitations = teamManager.pendingInvitations.filter(
        inv => inv.teamId !== teamId
      );
      
      await chrome.storage.local.set({
        pendingInvitations: teamManager.pendingInvitations
      });
      
      showSuccess('Has rechazado la invitación.');
      updatePendingInvitationsUI();
    } catch (error) {
      console.error('Error al rechazar invitación:', error);
      showError('Error al rechazar invitación: ' + error.message);
    }
  }
  
  // Manejar compartir pistas
  function handleShareClues() {
    // En una implementación real, aquí se mostraría un diálogo para seleccionar
    // qué pistas compartir con el equipo
    
    alert('Próximamente: Compartir pistas con tu equipo');
  }
  
  // Manejar volver a la pantalla principal
  function handleBack() {
    window.location.href = 'popup.html';
  }
  
  // Funciones auxiliares
  
  // Formatear nombre de rol
  function formatRoleName(role) {
    if (!role) return 'Sin rol asignado';
    
    const roleNames = {
      'decoder': 'Decodificador',
      'translator': 'Traductor',
      'visual-analyst': 'Analista Visual',
      'historian': 'Historiador',
      'navigator': 'Navegador'
    };
    
    return roleNames[role] || role;
  }
  
  // Formatear fecha
  function formatDate(timestamp) {
    if (!timestamp) return 'Desconocido';
    
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }
  
  // Generar código de invitación
  function generateInviteCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 8; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return code;
  }
  
  // Mostrar mensaje de error
  function showError(message) {
    // En una implementación real, aquí se mostraría un toast o notificación
    // Por ahora, usamos alert
    alert('Error: ' + message);
  }
  
  // Mostrar mensaje de éxito
  function showSuccess(message) {
    // En una implementación real, aquí se mostraría un toast o notificación
    // Por ahora, usamos alert
    alert('Éxito: ' + message);
  }
  
  // Event Listeners
  createTeamFormEl.addEventListener('submit', handleCreateTeam);
  inviteBtn.addEventListener('click', handleOpenInviteModal);
  shareCluesBtn.addEventListener('click', handleShareClues);
  backBtn.addEventListener('click', handleBack);
  
  // Event listeners para el modal de invitación
  closeInviteModalBtn.addEventListener('click', handleCloseInviteModal);
  copyInviteCodeBtn.addEventListener('click', handleCopyInviteCode);
  joinTeamBtn.addEventListener('click', handleJoinWithCode);
});