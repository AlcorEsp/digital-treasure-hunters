// Sistema de gestión de equipos para Digital Treasure Hunters

class TeamManager {
  constructor() {
    this.currentTeam = null;
    this.availableTeams = [];
    this.pendingInvitations = [];
    this.teamMembers = [];
  }

  // Inicializar el gestor de equipos
  async init() {
    try {
      // Cargar datos guardados
      const data = await chrome.storage.local.get(['currentTeam', 'availableTeams', 'pendingInvitations', 'teamMembers', 'user', 'role']);
      
      if (data.currentTeam) this.currentTeam = data.currentTeam;
      if (data.availableTeams && data.availableTeams.length > 0) {
        this.availableTeams = data.availableTeams;
      } else {
        // Equipos iniciales por defecto
        this.availableTeams = [
          {
            id: 'team-alpha',
            name: 'Equipo Alpha',
            description: 'Especialistas en criptografía y análisis visual en la red.',
            createdAt: Date.now() - 86400000 * 3,
            members: [
              { id: 'npc_1', name: 'María', role: 'decoder', isLeader: true },
              { id: 'npc_2', name: 'Carlos', role: 'visual-analyst', isLeader: false },
              { id: 'npc_3', name: 'Elena', role: 'historian', isLeader: false }
            ]
          },
          {
            id: 'team-beta',
            name: 'Equipo Beta',
            description: 'Exploradores de rutas ocultas y textos antiguos.',
            createdAt: Date.now() - 86400000 * 5,
            members: [
              { id: 'npc_4', name: 'Juan', role: 'navigator', isLeader: true },
              { id: 'npc_5', name: 'Sofía', role: 'translator', isLeader: false }
            ]
          }
        ];
        await chrome.storage.local.set({ availableTeams: this.availableTeams });
      }
      if (data.pendingInvitations) this.pendingInvitations = data.pendingInvitations;
      if (data.teamMembers) this.teamMembers = data.teamMembers;
      
      return true;
    } catch (error) {
      console.error('Error al inicializar el gestor de equipos:', error);
      return false;
    }
  }

  // Crear un nuevo equipo
  async createTeam(teamName, teamDescription) {
    try {
      const newTeam = {
        id: 'team_' + Date.now(),
        name: teamName,
        description: teamDescription,
        createdAt: Date.now(),
        createdBy: await this.getUserInfo(),
        members: []
      };
      
      // Añadir al usuario actual como líder del equipo
      const currentUser = await this.getUserInfo();
      newTeam.members.push({
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        joinedAt: Date.now(),
        isLeader: true
      });
      
      // Guardar el nuevo equipo
      this.availableTeams.push(newTeam);
      this.currentTeam = newTeam.id;
      this.teamMembers = newTeam.members;
      
      // Guardar en storage
      await chrome.storage.local.set({
        availableTeams: this.availableTeams,
        currentTeam: this.currentTeam,
        teamMembers: this.teamMembers
      });
      
      // Notificar al background script para actualizar objetivos de misión
      chrome.runtime.sendMessage({ action: 'teamJoined', teamId: newTeam.id }).catch(() => {});
      
      return newTeam;
    } catch (error) {
      console.error('Error al crear equipo:', error);
      return null;
    }
  }

  // Unirse a un equipo existente
  async joinTeam(teamId) {
    try {
      // Encontrar el equipo
      const team = this.availableTeams.find(t => t.id === teamId);
      if (!team) {
        throw new Error('Equipo no encontrado');
      }
      
      // Añadir al usuario al equipo
      const currentUser = await this.getUserInfo();
      team.members.push({
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        joinedAt: Date.now(),
        isLeader: false
      });
      
      // Actualizar el equipo actual
      this.currentTeam = teamId;
      this.teamMembers = team.members;
      
      // Guardar cambios
      await chrome.storage.local.set({
        availableTeams: this.availableTeams,
        currentTeam: this.currentTeam,
        teamMembers: this.teamMembers
      });
      
      // Notificar al background script para actualizar objetivos de misión
      chrome.runtime.sendMessage({ action: 'teamJoined', teamId: teamId }).catch(() => {});
      
      return team;
    } catch (error) {
      console.error('Error al unirse al equipo:', error);
      return null;
    }
  }

  // Invitar a un usuario a un equipo
  async inviteToTeam(teamId, invitedUserId) {
    try {
      // En una implementación real, aquí se enviaría una invitación
      // a través de un servidor o usando la API de mensajería de Chrome
      
      // Para esta demostración, simplemente simulamos una invitación
      const invitation = {
        teamId: teamId,
        invitedBy: await this.getUserInfo(),
        invitedAt: Date.now(),
        status: 'pending'
      };
      
      this.pendingInvitations.push(invitation);
      await chrome.storage.local.set({ pendingInvitations: this.pendingInvitations });
      
      return invitation;
    } catch (error) {
      console.error('Error al invitar al equipo:', error);
      return null;
    }
  }

  // Compartir una pista con el equipo
  async shareClue(clue) {
    try {
      if (!this.currentTeam) {
        throw new Error('No estás en ningún equipo');
      }
      
      const currentUser = await this.getUserInfo();
      
      // Añadir información sobre quién comparte la pista
      const sharedClue = {
        ...clue,
        sharedBy: currentUser.name,
        sharedAt: Date.now(),
        teamId: this.currentTeam
      };
      
      // En una implementación real, aquí se enviaría la pista
      // a los demás miembros del equipo a través de un servidor
      
      // Para esta demostración, simulamos guardar la pista compartida
      let sharedClues = await chrome.storage.local.get(['sharedClues']);
      sharedClues = sharedClues.sharedClues || [];
      sharedClues.push(sharedClue);
      
      await chrome.storage.local.set({ sharedClues });
      
      return true;
    } catch (error) {
      console.error('Error al compartir pista:', error);
      return false;
    }
  }

  // Obtener información del usuario actual
  async getUserInfo() {
    try {
      const userData = await chrome.storage.local.get(['user', 'role']);
      const role = (userData.user && userData.user.role) || userData.role || null;
      
      if (!userData.user) {
        return {
          id: 'user_local',
          name: 'Cazador',
          role: role
        };
      }
      
      return {
        id: userData.user.id || 'user_local',
        name: userData.user.name || 'Cazador',
        role: role
      };
    } catch (error) {
      console.error('Error al obtener info de usuario:', error);
      return {
        id: 'user_local',
        name: 'Cazador',
        role: null
      };
    }
  }

  // Obtener los equipos disponibles
  getAvailableTeams() {
    return this.availableTeams;
  }

  // Obtener el equipo actual
  getCurrentTeam() {
    if (!this.currentTeam) return null;
    return this.availableTeams.find(t => t.id === this.currentTeam);
  }

  // Obtener los miembros del equipo actual
  getTeamMembers() {
    return this.teamMembers;
  }

  // Comprobar si el usuario es líder del equipo
  async isTeamLeader() {
    try {
      if (!this.currentTeam) return false;
      
      const currentUser = await this.getUserInfo();
      const member = this.teamMembers.find(m => m.id === currentUser.id);
      
      return member && member.isLeader;
    } catch (error) {
      console.error('Error al comprobar líder:', error);
      return false;
    }
  }
}

// Exportar el gestor de equipos (compatible con ventana y Service Worker)
const teamGlobalScope = typeof self !== 'undefined' ? self : window;
teamGlobalScope.TeamManager = TeamManager;
