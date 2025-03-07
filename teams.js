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
      const data = await chrome.storage.local.get(['currentTeam', 'availableTeams', 'pendingInvitations', 'teamMembers']);
      
      if (data.currentTeam) this.currentTeam = data.currentTeam;
      if (data.availableTeams) this.availableTeams = data.availableTeams;
      if (data.pendingInvitations) this.pendingInvitations = data.pendingInvitations;
      if (data.teamMembers) this.teamMembers = data.teamMembers;
      
      // En una implementación real, aquí también se conectaría a un servidor
      // para obtener datos actualizados de los equipos
      
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
      const userData = await chrome.storage.local.get(['user']);
      
      if (!userData.user) {
        // Usuario por defecto si no hay datos
        return {
          id: 'user_' + Date.now(),
          name: 'Usuario',
          role: null
        };
      }
      
      return {
        id: userData.user.id || 'user_' + Date.now(),
        name: userData.user.name || 'Usuario',
        role: userData.user.role
      };
    } catch (error) {
      console.error('Error al obtener info de usuario:', error);
      return {
        id: 'user_' + Date.now(),
        name: 'Usuario',
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

// Exportar el gestor de equipos
window.TeamManager = TeamManager;
