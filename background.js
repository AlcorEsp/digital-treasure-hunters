// Background Script para Digital Treasure Hunters
// Este script se ejecuta en segundo plano continuamente

// Clase principal para gestionar la lógica del juego
class TreasureHunterGame {
  constructor() {
    // Estado del juego
    this.currentUser = {
      role: null,
      team: null,
      discoveredClues: []
    };
    
    // Misiones disponibles
    this.availableMissions = [
      {
        id: 'intro-mission',
        title: 'La primera pista',
        description: 'Encuentra tu primera pista oculta y descubre el misterio que hay detrás.',
        difficulty: 'fácil',
        cluesRequired: 3,
        progress: 0
      },
      {
        id: 'team-mission',
        title: 'Formando equipo',
        description: 'Reúne a un equipo completo con diferentes roles para desbloquear nuevos desafíos.',
        difficulty: 'fácil',
        teamRequired: true,
        progress: 0
      }
    ];
    
    // Equipos disponibles (en una implementación real esto estaría en una base de datos)
    this.teams = [
      {
        id: 'team-alpha',
        name: 'Equipo Alpha',
        members: [
          { name: 'María', role: 'decoder' },
          { name: 'Carlos', role: 'visual-analyst' },
          { name: 'Elena', role: 'historian' }
        ]
      },
      {
        id: 'team-beta',
        name: 'Equipo Beta',
        members: [
          { name: 'Juan', role: 'navigator' },
          { name: 'Sofía', role: 'translator' }
        ]
      }
    ];
    
    // Inicializar listeners
    this.initEventListeners();
    
    // Cargar datos guardados
    this.loadSavedData();
  }
  
  // Inicializar listeners para eventos
  initEventListeners() {
    // Escuchar mensajes de la extensión
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Si el usuario seleccionó un rol
      if (message.action === 'roleSelected') {
        this.handleRoleSelection(message.role);
        sendResponse({ success: true });
        return true;
      }
      
      // Si se encontró una nueva pista
      if (message.action === 'clueDiscovered') {
        this.handleClueDiscovery(message.clue, sender.tab.url);
        sendResponse({ success: true });
        return true;
      }
      
      // Si se solicita unirse a un equipo
      if (message.action === 'joinTeam') {
        this.handleJoinTeam(message.teamId);
        sendResponse({ success: true });
        return true;
      }
      
      // Si se solicita abrir la selección de rol
      if (message.action === 'openRoleSelection') {
        this.openRoleSelection();
        sendResponse({ success: true });
        return true;
      }
    });
    
    // Al instalar la extensión
    chrome.runtime.onInstalled.addListener(details => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      }
    });
    
    // Al navegar a una nueva página
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handlePageNavigation(tabId, tab.url);
      }
    });
  }
  
  // Abrir la selección de rol
  openRoleSelection() {
    chrome.storage.local.set({ showRoleSelection: true });
  }
  
  // Cargar datos guardados
  async loadSavedData() {
    try {
      const data = await chrome.storage.local.get(['user', 'currentMission']);
      
      if (data.user) {
        this.currentUser = data.user;
      }
      
      if (data.currentMission) {
        // Encontrar la misión correspondiente en las disponibles
        const mission = this.availableMissions.find(m => m.id === data.currentMission.id);
        if (mission) {
          // Actualizar con los datos guardados
          Object.assign(mission, data.currentMission);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos guardados:', error);
    }
  }
  
  // Manejar la primera instalación
  handleFirstInstall() {
    // Mostrar página de bienvenida
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
    
    // Inicializar datos del usuario
    chrome.storage.local.set({
      user: this.currentUser,
      onboarded: false
    });
  }
  
  // Manejar selección de rol
  async handleRoleSelection(role) {
    console.log(`Rol seleccionado: ${role}`);
    
    // Actualizar el rol del usuario
    this.currentUser.role = role;
    
    // Guardar el rol del usuario
    await chrome.storage.local.set({ user: this.currentUser });
    
    // Asignar misión introductoria
    const introMission = this.availableMissions.find(m => m.id === 'intro-mission');
    if (introMission) {
      await chrome.storage.local.set({ currentMission: introMission });
      
      // Notificar al usuario sobre la nueva misión
      this.showNotification(
        'Nueva misión asignada',
        `${introMission.title}: ${introMission.description}`
      );
    }
  }
  
  // Manejar descubrimiento de pista
  async handleClueDiscovery(clue, sourceUrl) {
    console.log('Nueva pista descubierta:', clue);
    
    // Añadir la URL de origen
    clue.source = sourceUrl;
    clue.discoveredAt = Date.now();
    
    // Añadir a las pistas descubiertas
    this.currentUser.discoveredClues.push(clue);
    
    // Actualizar datos del usuario
    await chrome.storage.local.set({ user: this.currentUser });
    
    // Actualizar progreso de la misión actual
    const data = await chrome.storage.local.get(['currentMission']);
    if (data.currentMission) {
      const mission = data.currentMission;
      
      // Actualizar progreso
      if (mission.cluesRequired) {
        const cluesFound = this.currentUser.discoveredClues.length;
        const progress = Math.min(100, Math.floor((cluesFound / mission.cluesRequired) * 100));
        
        mission.progress = progress;
        
        // Guardar misión actualizada
        await chrome.storage.local.set({ currentMission: mission });
        
        // Si se completó la misión
        if (progress >= 100) {
          this.handleMissionComplete(mission);
        }
      }
    }
    
    // Mostrar notificación
    this.showNotification('¡Nueva pista descubierta!', clue.content);
  }
  
  // Manejar unirse a un equipo
  async handleJoinTeam(teamId) {
    console.log(`Unirse al equipo: ${teamId}`);
    
    // Buscar el equipo
    const team = this.teams.find(t => t.id === teamId);
    if (!team) {
      console.error(`Equipo no encontrado: ${teamId}`);
      return;
    }
    
    // Añadir al usuario al equipo
    const userName = 'Usuario';  // En una implementación real, esto sería personalizable
    team.members.push({
      name: userName,
      role: this.currentUser.role
    });
    
    // Actualizar el equipo del usuario
    this.currentUser.team = team.id;
    
    // Guardar los datos
    await chrome.storage.local.set({ user: this.currentUser });
    
    // Actualizar la misión de equipo si está activa
    const data = await chrome.storage.local.get(['currentMission']);
    if (data.currentMission && data.currentMission.id === 'team-mission') {
      const mission = data.currentMission;
      mission.progress = 100;  // Completar la misión
      
      await chrome.storage.local.set({ currentMission: mission });
      
      // Manejar la misión completada
      this.handleMissionComplete(mission);
    }
    
    // Notificar al usuario
    this.showNotification(
      '¡Te has unido a un equipo!',
      `Ahora formas parte de ${team.name}.`
    );
  }
  
  // Manejar navegación a una nueva página
  async handlePageNavigation(tabId, url) {
    // En una implementación real, aquí se comprobaría si la página forma parte
    // de la misión actual y se enviarían mensajes al content script
    
    try {
      // Verificar si el usuario tiene un rol asignado
      const data = await chrome.storage.local.get(['user', 'currentMission']);
      
      if (data.user && data.user.role && data.currentMission) {
        // Enviar información al content script
        chrome.tabs.sendMessage(tabId, {
          action: 'checkPage',
          role: data.user.role,
          mission: data.currentMission
        }).catch(err => {
          // Es normal que esto falle en algunas páginas donde el content script no puede ejecutarse
          console.debug('No se pudo enviar mensaje a la pestaña:', err);
        });
      }
    } catch (error) {
      console.error('Error al manejar navegación:', error);
    }
  }
  
  // Manejar una misión completada
  async handleMissionComplete(mission) {
    console.log(`Misión completada: ${mission.id}`);
    
    // Mostrar notificación
    this.showNotification(
      '¡Misión completada!',
      `Has completado la misión: ${mission.title}`
    );
    
    // En una implementación real, aquí se desbloquearía la siguiente misión
    // Por ahora, simplemente asignamos la misión de equipo si completaron la intro
    if (mission.id === 'intro-mission') {
      const teamMission = this.availableMissions.find(m => m.id === 'team-mission');
      if (teamMission) {
        await chrome.storage.local.set({ currentMission: teamMission });
        
        // Notificar sobre la nueva misión
        this.showNotification(
          'Nueva misión asignada',
          `${teamMission.title}: ${teamMission.description}`
        );
      }
    }
  }
  
  // Mostrar una notificación
  showNotification(title, message) {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: title,
        message: message
      });
    } else {
      console.log(`Notificación: ${title} - ${message}`);
    }
  }
}

// Inicializar el juego
const game = new TreasureHunterGame();

// Para solucionar el problema con el mensaje de "Invalid Host Permission"
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensión Digital Treasure Hunters instalada correctamente");
});
