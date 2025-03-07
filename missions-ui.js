// Lógica de interfaz para la gestión de misiones
document.addEventListener('DOMContentLoaded', async function() {
  // Inicializar el gestor de misiones
  const missionManager = new MissionManager();
  await missionManager.init();
  
  // Referencias a elementos del DOM
  const currentMissionEl = document.getElementById('current-mission');
  const missionObjectivesEl = document.getElementById('mission-objectives');
  const availableMissionsEl = document.getElementById('available-missions');
  const completedMissionsEl = document.getElementById('completed-missions');
  const refreshBtn = document.getElementById('refresh-btn');
  const abandonMissionBtn = document.getElementById('abandon-mission-btn');
  const backBtn = document.getElementById('back-btn');
  
  // Referencias para el modal de detalles
  const detailsModal = document.getElementById('mission-details-modal');
  const modalTitleEl = document.getElementById('modal-mission-title');
  const modalDescriptionEl = document.getElementById('modal-mission-description');
  const modalObjectivesEl = document.getElementById('modal-mission-objectives');
  const modalRewardsEl = document.getElementById('modal-mission-rewards');
  const modalRequirementsEl = document.getElementById('modal-mission-requirements');
  const closeDetailsBtn = document.getElementById('close-details-modal');
  const acceptMissionBtn = document.getElementById('accept-mission-btn');
  
  // Variables globales para el modal
  let selectedMissionId = null;
  
  // Inicializar la interfaz
  initializeUI();
  
  // Función para inicializar la interfaz
  async function initializeUI() {
    try {
      // Cargar datos de la misión actual
      updateCurrentMissionUI();
      
      // Cargar objetivos de la misión
      updateObjectivesUI();
      
      // Cargar misiones disponibles
      updateAvailableMissionsUI();
      
      // Cargar misiones completadas
      updateCompletedMissionsUI();
      
      // Habilitar/deshabilitar botones según estado
      if (!missionManager.currentMission) {
        abandonMissionBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error al inicializar UI:', error);
      showError('Error al cargar datos de misiones. Por favor, inténtalo de nuevo.');
    }
  }
  
  // Función para actualizar la UI de la misión actual
  function updateCurrentMissionUI() {
    const missionDetails = missionManager.getCurrentMissionDetails();
    
    if (!missionDetails) {
      currentMissionEl.innerHTML = `
        <div class="no-missions">
          <p>No tienes ninguna misión activa actualmente.</p>
          <p>Acepta una nueva misión para continuar tu aventura.</p>
        </div>
      `;
      return;
    }
    
    const difficultyIndicators = generateDifficultyIndicators(missionDetails.difficulty);
    
    currentMissionEl.innerHTML = `
      <div class="mission-card current">
        <h3>${missionDetails.title} <span class="mission-badge current-badge">Actual</span></h3>
        <p>${missionDetails.description}</p>
        <div class="mission-meta">
          <span class="mission-type ${missionDetails.type}">${formatMissionType(missionDetails.type)}</span>
          <span class="mission-difficulty">${difficultyIndicators}</span>
        </div>
        <div class="mission-progress-bar">
          <div class="mission-progress" style="width: ${missionDetails.progress}%"></div>
        </div>
        <p class="mission-progress-text">${missionDetails.completedObjectives} de ${missionDetails.totalObjectives} objetivos completados</p>
        <div class="mission-actions">
          <button class="secondary-btn mission-details-btn" data-mission-id="${missionDetails.id}">Ver detalles</button>
        </div>
      </div>
    `;
    
    // Añadir event listener para el botón de detalles
    const detailsBtn = currentMissionEl.querySelector('.mission-details-btn');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', handleShowMissionDetails);
    }
  }
  
  // Función para actualizar la UI de objetivos
  function updateObjectivesUI() {
    const missionDetails = missionManager.getCurrentMissionDetails();
    
    if (!missionDetails) {
      missionObjectivesEl.innerHTML = `
        <div class="no-missions">
          <p>No hay objetivos disponibles.</p>
        </div>
      `;
      return;
    }
    
    const progressData = missionManager.missionProgress[missionDetails.id];
    
    if (!progressData) {
      missionObjectivesEl.innerHTML = `
        <div class="no-missions">
          <p>Error al cargar objetivos. Por favor, intenta más tarde.</p>
        </div>
      `;
      return;
    }
    
    const objectivesHTML = missionDetails.objectives.map(objective => {
      const objProgress = progressData.objectives[objective.id] || { completed: false, progress: 0, required: objective.required || 1 };
      let statusClass = 'pending';
      let statusIcon = '⭕';
      
      if (objProgress.completed) {
        statusClass = 'completed';
        statusIcon = '✅';
      } else if (objProgress.progress > 0) {
        statusClass = 'in-progress';
        statusIcon = '⏳';
      }
      
      let progressText = '';
      if (objective.required && objective.required > 1) {
        progressText = `${objProgress.progress} / ${objProgress.required}`;
      }
      
      return `
        <li class="objective-item ${statusClass}">
          <div class="objective-icon ${statusClass}">${statusIcon}</div>
          <div class="objective-content">
            <div class="objective-title">${objective.description}</div>
            ${progressText ? `<div class="objective-progress">${progressText}</div>` : ''}
          </div>
        </li>
      `;
    }).join('');
    
    missionObjectivesEl.innerHTML = `
      <ul class="objectives-list">
        ${objectivesHTML}
      </ul>
    `;
  }
  
  // Función para actualizar la UI de misiones disponibles
  function updateAvailableMissionsUI() {
    const allMissions = missionManager.getAllMissionsWithStatus();
    const availableMissions = allMissions.filter(m => m.isAvailable && !m.isCompleted && !m.isCurrent);
    
    if (!availableMissions || availableMissions.length === 0) {
      availableMissionsEl.innerHTML = `
        <div class="no-missions">
          <p>No hay misiones disponibles actualmente.</p>
          <p>Completa tu misión actual para desbloquear más.</p>
        </div>
      `;
      return;
    }
    
    availableMissionsEl.innerHTML = `
      <div class="missions-list">
        ${availableMissions.map(mission => {
          const difficultyIndicators = generateDifficultyIndicators(mission.difficulty);
          
          return `
            <div class="mission-card">
              <h3>${mission.title}</h3>
              <p>${mission.description}</p>
              <div class="mission-meta">
                <span class="mission-type ${mission.type}">${formatMissionType(mission.type)}</span>
                <span class="mission-difficulty">${difficultyIndicators}</span>
              </div>
              <div class="mission-actions">
                <button class="secondary-btn mission-details-btn" data-mission-id="${mission.id}">Ver detalles</button>
                <button class="primary-btn accept-mission-btn" data-mission-id="${mission.id}">Aceptar misión</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    // Añadir event listeners para los botones
    const detailsBtns = availableMissionsEl.querySelectorAll('.mission-details-btn');
    const acceptBtns = availableMissionsEl.querySelectorAll('.accept-mission-btn');
    
    detailsBtns.forEach(btn => {
      btn.addEventListener('click', handleShowMissionDetails);
    });
    
    acceptBtns.forEach(btn => {
      btn.addEventListener('click', handleAcceptMission);
    });
  }
  
  // Función para actualizar la UI de misiones completadas
  function updateCompletedMissionsUI() {
    const allMissions = missionManager.getAllMissionsWithStatus();
    const completedMissions = allMissions.filter(m => m.isCompleted);
    
    if (!completedMissions || completedMissions.length === 0) {
      completedMissionsEl.innerHTML = `
        <div class="no-missions">
          <p>No has completado ninguna misión todavía.</p>
        </div>
      `;
      return;
    }
    
    completedMissionsEl.innerHTML = `
      <div class="missions-list">
        ${completedMissions.map(mission => {
          const difficultyIndicators = generateDifficultyIndicators(mission.difficulty);
          
          return `
            <div class="mission-card completed">
              <h3>${mission.title} <span class="mission-badge completed-badge">Completada</span></h3>
              <p>${mission.description}</p>
              <div class="mission-meta">
                <span class="mission-type ${mission.type}">${formatMissionType(mission.type)}</span>
                <span class="mission-difficulty">${difficultyIndicators}</span>
              </div>
              <div class="mission-progress-bar">
                <div class="mission-progress" style="width: 100%"></div>
              </div>
              <div class="mission-actions">
                <button class="secondary-btn mission-details-btn" data-mission-id="${mission.id}">Ver detalles</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    // Añadir event listeners para los botones
    const detailsBtns = completedMissionsEl.querySelectorAll('.mission-details-btn');
    
    detailsBtns.forEach(btn => {
      btn.addEventListener('click', handleShowMissionDetails);
    });
  }
  
  // Event Handlers
  
  // Manejar mostrar detalles de misión
  function handleShowMissionDetails(e) {
    const missionId = e.target.dataset.missionId;
    
    if (!missionId) {
      showError('ID de misión no válido.');
      return;
    }
    
    // Buscar la misión
    const mission = missionManager.availableMissions.find(m => m.id === missionId);
    
    if (!mission) {
      showError('Misión no encontrada.');
      return;
    }
    
    // Guardar ID de misión seleccionada
    selectedMissionId = missionId;
    
    // Actualizar el modal con la información de la misión
    modalTitleEl.textContent = mission.title;
    modalDescriptionEl.textContent = mission.description;
    
    // Actualizar objetivos
    modalObjectivesEl.innerHTML = mission.objectives.map(obj => `
      <li>${obj.description}</li>
    `).join('');
    
    // Actualizar recompensas
    modalRewardsEl.innerHTML = '';
    if (mission.rewards) {
      const rewardsList = [];
      
      if (mission.rewards.xp) {
        rewardsList.push(`<li>${mission.rewards.xp} puntos de experiencia</li>`);
      }
      
      if (mission.rewards.unlocksTools && mission.rewards.unlocksTools.length > 0) {
        rewardsList.push(`<li>Desbloquea herramientas: ${mission.rewards.unlocksTools.join(', ')}</li>`);
      }
      
      if (mission.rewards.unlocksRoles && mission.rewards.unlocksRoles.length > 0) {
        rewardsList.push(`<li>Desbloquea roles: ${mission.rewards.unlocksRoles.join(', ')}</li>`);
      }
      
      if (mission.rewards.unlocksAchievement) {
        rewardsList.push(`<li>Desbloquea logro: ${mission.rewards.unlocksAchievement}</li>`);
      }
      
      if (mission.rewards.teamBonus) {
        rewardsList.push(`<li>Bonus de equipo</li>`);
      }
      
      modalRewardsEl.innerHTML = rewardsList.join('');
    }
    
    if (modalRewardsEl.innerHTML === '') {
      modalRewardsEl.innerHTML = '<li>Sin recompensas especiales</li>';
    }
    
    // Actualizar requisitos
    modalRequirementsEl.innerHTML = '';
    if (mission.requirements && mission.requirements.length > 0) {
      const reqMissions = mission.requirements.map(reqId => {
        const reqMission = missionManager.availableMissions.find(m => m.id === reqId);
        return reqMission ? reqMission.title : reqId;
      });
      
      modalRequirementsEl.innerHTML = reqMissions.map(req => `
        <li>${req}</li>
      `).join('');
    } else {
      modalRequirementsEl.innerHTML = '<li>Sin requisitos previos</li>';
    }
    
    // Verificar si la misión ya está asignada o completada
    const isCurrent = missionManager.currentMission === missionId;
    const isCompleted = missionManager.completedMissions.includes(missionId);
    
    // Mostrar/ocultar botón de aceptar misión según estado
    if (isCurrent || isCompleted) {
      acceptMissionBtn.style.display = 'none';
    } else {
      acceptMissionBtn.style.display = 'block';
    }
    
    // Mostrar el modal
    detailsModal.classList.remove('hidden');
  }
  
  // Manejar cierre del modal
  function handleCloseModal() {
    detailsModal.classList.add('hidden');
    selectedMissionId = null;
  }
  
  // Manejar aceptar misión
  async function handleAcceptMission(e) {
    // Si se llamó desde el botón en la lista, obtener ID de misión
    let missionId = e.target.dataset.missionId;
    
    // Si se llamó desde el modal, usar la misión seleccionada
    if (!missionId && selectedMissionId) {
      missionId = selectedMissionId;
    }
    
    if (!missionId) {
      showError('ID de misión no válido.');
      return;
    }
    
    try {
      // Verificar si el usuario ya tiene una misión activa
      if (missionManager.currentMission) {
        if (!confirm('Ya tienes una misión activa. ¿Quieres abandonarla y aceptar esta nueva misión?')) {
          return;
        }
        
        // Aquí podríamos implementar lógica para guardar el progreso de la misión actual
        // o penalizar por abandonarla, dependiendo del diseño del juego
      }
      
      // Asignar la nueva misión
      const result = await missionManager.assignMission(missionId);
      
      if (result) {
        showSuccess(`¡Has aceptado la misión "${result.title}"!`);
        
        // Cerrar el modal si estaba abierto
        handleCloseModal();
        
        // Actualizar la interfaz
        initializeUI();
      } else {
        showError('Hubo un problema al aceptar la misión. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error al aceptar misión:', error);
      showError('Error al aceptar misión: ' + error.message);
    }
  }
  
  // Manejar abandonar misión
  async function handleAbandonMission() {
    if (!missionManager.currentMission) {
      showError('No tienes ninguna misión activa para abandonar.');
      return;
    }
    
    if (!confirm('¿Estás seguro de que quieres abandonar esta misión? Perderás todo el progreso.')) {
      return;
    }
    
    try {
      // En una implementación real, aquí se guardaría algún registro del abandono
      // o se aplicaría alguna penalización
      
      // Simplemente eliminamos la misión actual
      missionManager.currentMission = null;
      
      // Guardar cambios
      await chrome.storage.local.set({ currentMission: null });
      
      showSuccess('Has abandonado la misión.');
      
      // Actualizar la interfaz
      initializeUI();
    } catch (error) {
      console.error('Error al abandonar misión:', error);
      showError('Error al abandonar misión: ' + error.message);
    }
  }
  
  // Manejar actualización de progreso
  async function handleRefreshProgress() {
    try {
      // En una implementación real, aquí se verificaría el progreso de la misión
      // contra el estado actual del juego (pistas encontradas, etc.)
      
      // Por ahora, simulamos completar un objetivo aleatorio
      if (missionManager.currentMission) {
        const mission = missionManager.getCurrentMissionDetails();
        
        if (mission) {
          // Encontrar un objetivo no completado
          const pendingObjectives = mission.objectives.filter(obj => {
            const progress = mission.details.objectives[obj.id];
            return progress && !progress.completed;
          });
          
          if (pendingObjectives.length > 0) {
            // Completar un objetivo aleatorio
            const randomObj = pendingObjectives[Math.floor(Math.random() * pendingObjectives.length)];
            await missionManager.completeObjective(randomObj.id);
            
            showSuccess(`¡Has completado el objetivo: ${randomObj.description}!`);
          } else {
            showSuccess('¡Ya has completado todos los objetivos de esta misión!');
          }
          
          // Actualizar la interfaz
          initializeUI();
        }
      } else {
        showInfo('No tienes ninguna misión activa para actualizar.');
      }
    } catch (error) {
      console.error('Error al actualizar progreso:', error);
      showError('Error al actualizar progreso: ' + error.message);
    }
  }
  
  // Manejar volver a la pantalla principal
  function handleBack() {
    window.location.href = 'popup.html';
  }
  
  // Funciones auxiliares
  
  // Formatear tipo de misión
  function formatMissionType(type) {
    const typeLabels = {
      'tutorial': 'Tutorial',
      'social': 'Social',
      'role-specific': 'Rol',
      'collaboration': 'Equipo'
    };
    
    return typeLabels[type] || type;
  }
  
  // Generar indicadores de dificultad
  function generateDifficultyIndicators(difficulty) {
    let level = 1;
    
    switch (difficulty) {
      case 'fácil': level = 1; break;
      case 'medio': level = 2; break;
      case 'difícil': level = 3; break;
      default: level = 1;
    }
    
    let indicators = '';
    for (let i = 1; i <= 3; i++) {
      indicators += `<span class="difficulty-indicator ${i <= level ? 'active' : 'inactive'}"></span>`;
    }
    
    return indicators;
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
  
  // Mostrar mensaje informativo
  function showInfo(message) {
    // En una implementación real, aquí se mostraría un toast o notificación
    // Por ahora, usamos alert
    alert('Info: ' + message);
  }
  
  // Event Listeners
  refreshBtn.addEventListener('click', handleRefreshProgress);
  abandonMissionBtn.addEventListener('click', handleAbandonMission);
  backBtn.addEventListener('click', handleBack);
  
  // Event listeners para el modal
  closeDetailsBtn.addEventListener('click', handleCloseModal);
  acceptMissionBtn.addEventListener('click', handleAcceptMission);
});mission-progress" style="width: 100%"></div>
              </div>
              <div class="mission-actions">
                <button class="secondary-btn mission-details-btn" data-mission-id="${mission.id}">Ver detalles</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    // Añadir event listeners para los botones
    const detailsBtns = completedMissionsEl.querySelectorAll('.mission-details-btn');
    
    detailsBtns.forEach(btn => {
      btn.addEventListener('click', handleShowMissionDetails);
    });
  }
  
  // Event Handlers
  
  // Manejar mostrar detalles de misión
  function handleShowMissionDetails(e) {
    const missionId = e.target.dataset.missionId;
    
    if (!missionId) {
      showError('ID de misión no válido.');
      return;
    }
    
    // Buscar la misión
    const mission = missionManager.availableMissions.find(m => m.id === missionId);
    
    if (!mission) {
      showError('Misión no encontrada.');
      return;
    }
    
    // Guardar ID de misión seleccionada
    selectedMissionId = missionId;
    
    // Actualizar el modal con la información de la misión
    modalTitleEl.textContent = mission.title;
    modalDescriptionEl.textContent = mission.description;
    
    // Actualizar objetivos
    modalObjectivesEl.innerHTML = mission.objectives.map(obj => `
      <li>${obj.description}</li>
    `).join('');
    
    // Actualizar recompensas
    modalRewardsEl.innerHTML = '';
    if (mission.rewards) {
      const rewardsList = [];
      
      if (mission.rewards.xp) {
        rewardsList.push(`<li>${mission.rewards.xp} puntos de experiencia</li>`);
      }
      
      if (mission.rewards.unlocksTools && mission.rewards.unlocksTools.length > 0) {
        rewardsList.push(`<li>Desbloquea herramientas: ${mission.rewards.unlocksTools.join(', ')}</li>`);
      }
      
      if (mission.rewards.unlocksRoles && mission.rewards.unlocksRoles.length > 0) {
        rewardsList.push(`<li>Desbloquea roles: ${mission.rewards.unlocksRoles.join(', ')}</li>`);
      }
      
      if (mission.rewards.unlocksAchievement) {
        rewardsList.push(`<li>Desbloquea logro: ${mission.rewards.unlocksAchievement}</li>`);
      }
      
      if (mission.rewards.teamBonus) {
        rewardsList.push(`<li>Bonus de equipo</li>`);
      }
      
      modalRewardsEl.innerHTML = rewardsList.join('');
    }
    
    if (modalRewardsEl.innerHTML === '') {
      modalRewardsEl.innerHTML = '<li>Sin recompensas especiales</li>';
    }
    
    // Actualizar requisitos
    modalRequirementsEl.innerHTML = '';
    if (mission.requirements && mission.requirements.length > 0) {
      const reqMissions = mission.requirements.map(reqId => {
        const reqMission = missionManager.availableMissions.find(m => m.id === reqId);
        return reqMission ? reqMission.title : reqId;
      });
      
      modalRequirementsEl.innerHTML = reqMissions.map(req => `
        <li>${req}</li>
      `).join('');
    } else {
      modalRequirementsEl.innerHTML = '<li>Sin requisitos previos</li>';
    }
    
    // Verificar si la misión ya está asignada o completada
    const isCurrent = missionManager.currentMission === missionId;
    const isCompleted = missionManager.completedMissions.includes(missionId);
    
    // Mostrar/ocultar botón de aceptar misión según estado
    if (isCurrent || isCompleted) {
      acceptMissionBtn.style.display = 'none';
    } else {
      acceptMissionBtn.style.display = 'block';
    }
    
    // Mostrar el modal
    detailsModal.classList.remove('hidden');
  }
  
  // Manejar cierre del modal
  function handleCloseModal() {
    detailsModal.classList.add('hidden');
    selectedMissionId = null;
  }
  
  // Manejar aceptar misión
  async function handleAcceptMission(e) {
    // Si se llamó desde el botón en la lista, obtener ID de misión
    let missionId = e.target.dataset.missionId;
    
    // Si se llamó desde el modal, usar la misión seleccionada
    if (!missionId && selectedMissionId) {
      missionId = selectedMissionId;
    }
    
    if (!missionId) {
      showError('ID de misión no válido.');
      return;
    }
    
    try {
      // Verificar si el usuario ya tiene una misión activa
      if (missionManager.currentMission) {
        if (!confirm('Ya tienes una misión activa. ¿Quieres abandonarla y aceptar esta nueva misión?')) {
          return;
        }
        
        // Aquí podríamos implementar lógica para guardar el progreso de la misión actual
        // o penalizar por abandonarla, dependiendo del diseño del juego
      }
      
      // Asignar la nueva misión
      const result = await missionManager.assignMission(missionId);
      
      if (result) {
        showSuccess(`¡Has aceptado la misión "${result.title}"!`);
        
        // Cerrar el modal si estaba abierto
        handle