// Sistema de misiones para Digital Treasure Hunters

class MissionManager {
  constructor() {
    this.currentMission = null;
    this.completedMissions = [];
    this.missionProgress = {};
    this.availableMissions = [];
    
    // Inicializar misiones predefinidas
    this.initializeMissions();
  }
  
  // Inicializar el sistema de misiones
  async init() {
    try {
      // Cargar datos guardados
      const data = await chrome.storage.local.get(['currentMission', 'completedMissions', 'missionProgress']);
      
      if (data.currentMission) this.currentMission = data.currentMission;
      if (data.completedMissions) this.completedMissions = data.completedMissions;
      if (data.missionProgress) this.missionProgress = data.missionProgress;
      
      // Verificar si es necesario asignar una misión inicial
      if (!this.currentMission && this.availableMissions.length > 0) {
        // Asignar la primera misión disponible
        await this.assignMission(this.availableMissions[0].id);
      }
      
      return true;
    } catch (error) {
      console.error('Error al inicializar el gestor de misiones:', error);
      return false;
    }
  }
  
  // Inicializar las misiones predefinidas
  initializeMissions() {
    this.availableMissions = [
      // Misión tutorial
      {
        id: 'mission-tutorial',
        title: 'Primeros pasos',
        description: 'Aprende los conceptos básicos de la búsqueda de tesoros digitales.',
        type: 'tutorial',
        difficulty: 'fácil',
        requirements: [],
        objectives: [
          {
            id: 'select-role',
            description: 'Selecciona un rol especializado',
            completed: false
          },
          {
            id: 'find-first-clue',
            description: 'Encuentra tu primera pista',
            completed: false,
            count: 0,
            required: 1
          },
          {
            id: 'view-team-page',
            description: 'Visita la página de equipos',
            completed: false
          }
        ],
        rewards: {
          xp: 100,
          unlocksRoles: []
        }
      },
      
      // Misión para formar equipo
      {
        id: 'mission-team-up',
        title: 'Únete a la red',
        description: 'Forma parte de un equipo de cazadores de tesoros o crea el tuyo propio.',
        type: 'social',
        difficulty: 'fácil',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'join-team',
            description: 'Únete a un equipo existente o crea uno nuevo',
            completed: false
          },
          {
            id: 'invite-member',
            description: 'Invita a un nuevo miembro a tu equipo',
            completed: false
          }
        ],
        rewards: {
          xp: 200,
          teamBonus: true
        }
      },
      
      // Misión específica de rol - Decodificador
      {
        id: 'mission-decoder-basics',
        title: 'El código oculto',
        description: 'Encuentra y descifra códigos ocultos en páginas web.',
        type: 'role-specific',
        forRole: 'decoder',
        difficulty: 'medio',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-encoded-message',
            description: 'Descubre 3 mensajes codificados en páginas web',
            completed: false,
            count: 0,
            required: 3
          },
          {
            id: 'decode-base64',
            description: 'Descifra un mensaje en formato Base64',
            completed: false
          }
        ],
        rewards: {
          xp: 300,
          unlocksTools: ['base64-decoder']
        }
      },
      
      // Misión específica de rol - Traductor
      {
        id: 'mission-translator-basics',
        title: 'Lenguas olvidadas',
        description: 'Descubre y traduce textos en idiomas poco comunes.',
        type: 'role-specific',
        forRole: 'translator',
        difficulty: 'medio',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-foreign-text',
            description: 'Descubre 3 textos en idiomas extranjeros',
            completed: false,
            count: 0,
            required: 3
          },
          {
            id: 'identify-languages',
            description: 'Identifica correctamente 2 idiomas distintos',
            completed: false,
            count: 0,
            required: 2
          }
        ],
        rewards: {
          xp: 300,
          unlocksTools: ['language-identifier']
        }
      },
      
      // Misión específica de rol - Analista Visual
      {
        id: 'mission-visual-basics',
        title: 'El ojo que todo lo ve',
        description: 'Encuentra pistas ocultas en imágenes y elementos visuales.',
        type: 'role-specific',
        forRole: 'visual-analyst',
        difficulty: 'medio',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-hidden-images',
            description: 'Descubre 3 imágenes con pistas ocultas',
            completed: false,
            count: 0,
            required: 3
          },
          {
            id: 'identify-pattern',
            description: 'Identifica un patrón visual oculto',
            completed: false
          }
        ],
        rewards: {
          xp: 300,
          unlocksTools: ['image-analyzer']
        }
      },
      
      // Misión de colaboración
      {
        id: 'mission-first-collab',
        title: 'Operación conjunta',
        description: 'Trabaja con tu equipo para resolver un desafío que requiere múltiples roles.',
        type: 'collaboration',
        difficulty: 'difícil',
        requirements: ['mission-team-up'],
        objectives: [
          {
            id: 'share-clues',
            description: 'Comparte al menos 2 pistas con tu equipo',
            completed: false,
            count: 0,
            required: 2
          },
          {
            id: 'team-solve-puzzle',
            description: 'Resuelve un acertijo que requiere al menos 2 roles diferentes',
            completed: false,
            rolesRequired: 2
          },
          {
            id: 'find-team-treasure',
            description: 'Descubre un tesoro digital que solo puede ser encontrado en equipo',
            completed: false
          }
        ],
        rewards: {
          xp: 500,
          unlocksAchievement: 'first-collaboration'
        }
      }
    ];
  }
  
  // Asignar una nueva misión al jugador
  async assignMission(missionId) {
    try {
      // Buscar la misión en las disponibles
      const mission = this.availableMissions.find(m => m.id === missionId);
      
      if (!mission) {
        throw new Error(`Misión no encontrada: ${missionId}`);
      }
      
      // Verificar requisitos previos
      const meetsRequirements = this.checkMissionRequirements(mission);
      
      if (!meetsRequirements) {
        throw new Error('No cumples los requisitos para esta misión');
      }
      
      // Inicializar progreso para esta misión
      this.missionProgress[missionId] = {
        started: Date.now(),
        lastUpdated: Date.now(),
        objectives: {}
      };
      
      // Inicializar objetivos
      mission.objectives.forEach(obj => {
        this.missionProgress[missionId].objectives[obj.id] = {
          completed: false,
          progress: 0,
          required: obj.required || 1
        };
      });
      
      // Actualizar misión actual
      this.currentMission = missionId;
      
      // Guardar en storage
      await chrome.storage.local.set({
        currentMission: this.currentMission,
        missionProgress: this.missionProgress
      });
      
      return mission;
    } catch (error) {
      console.error('Error al asignar misión:', error);
      return null;
    }
  }
  
  // Verificar si se cumplen los requisitos para una misión
  checkMissionRequirements(mission) {
    // Si no hay requisitos, se cumple automáticamente
    if (!mission.requirements || mission.requirements.length === 0) {
      return true;
    }
    
    // Verificar que todas las misiones requeridas estén completadas
    return mission.requirements.every(reqMissionId => 
      this.completedMissions.includes(reqMissionId)
    );
  }
  
  // Actualizar progreso de un objetivo
  async updateObjectiveProgress(objectiveId, increment = 1) {
    try {
      if (!this.currentMission) {
        return false;
      }
      
      const mission = this.availableMissions.find(m => m.id === this.currentMission);
      
      if (!mission) {
        return false;
      }
      
      // Buscar el objetivo en la misión actual
      const objective = mission.objectives.find(obj => obj.id === objectiveId);
      
      if (!objective) {
        return false;
      }
      
      // Obtener el progreso actual
      const progress = this.missionProgress[this.currentMission].objectives[objectiveId];
      
      // Si ya está completado, no hacer nada
      if (progress.completed) {
        return true;
      }
      
      // Actualizar progreso
      progress.progress += increment;
      progress.lastUpdated = Date.now();
      
      // Verificar si se ha completado
      if (progress.progress >= progress.required) {
        progress.completed = true;
        
        // Verificar si todos los objetivos están completados
        const allCompleted = Object.values(this.missionProgress[this.currentMission].objectives)
          .every(obj => obj.completed);
        
        if (allCompleted) {
          await this.completeMission(this.currentMission);
        }
      }
      
      // Guardar progreso
      await chrome.storage.local.set({
        missionProgress: this.missionProgress
      });
      
      return true;
    } catch (error) {
      console.error('Error al actualizar objetivo:', error);
      return false;
    }
  }
  
  // Marcar un objetivo como completado
  async completeObjective(objectiveId) {
    return this.updateObjectiveProgress(objectiveId, Number.MAX_SAFE_INTEGER);
  }
  
  // Completar una misión
  async completeMission(missionId) {
    try {
      // Añadir a misiones completadas
      if (!this.completedMissions.includes(missionId)) {
        this.completedMissions.push(missionId);
      }
      
      // Quitar de misión actual si es la actual
      if (this.currentMission === missionId) {
        this.currentMission = null;
      }
      
      // Aplicar recompensas
      await this.applyMissionRewards(missionId);
      
      // Guardar cambios
      await chrome.storage.local.set({
        currentMission: this.currentMission,
        completedMissions: this.completedMissions
      });
      
      // Asignar siguiente misión si existe
      const nextMission = this.findNextAvailableMission();
      if (nextMission) {
        await this.assignMission(nextMission.id);
      }
      
      return true;
    } catch (error) {
      console.error('Error al completar misión:', error);
      return false;
    }
  }
  
  // Aplicar recompensas de una misión
  async applyMissionRewards(missionId) {
    try {
      const mission = this.availableMissions.find(m => m.id === missionId);
      
      if (!mission || !mission.rewards) {
        return false;
      }
      
      // En una implementación real, aquí se aplicarían las recompensas
      // al perfil del usuario
      
      // Por ahora, solo registramos las recompensas
      console.log(`Recompensas de misión ${missionId}:`, mission.rewards);
      
      // Obtener datos del usuario
      const userData = await chrome.storage.local.get(['user']);
      let user = userData.user || { xp: 0, tools: [], achievements: [] };
      
      // Añadir XP
      if (mission.rewards.xp) {
        user.xp = (user.xp || 0) + mission.rewards.xp;
      }
      
      // Desbloquear herramientas
      if (mission.rewards.unlocksTools) {
        user.tools = [...(user.tools || []), ...mission.rewards.unlocksTools];
      }
      
      // Desbloquear logros
      if (mission.rewards.unlocksAchievement) {
        user.achievements = [...(user.achievements || []), mission.rewards.unlocksAchievement];
      }
      
      // Guardar usuario actualizado
      await chrome.storage.local.set({ user });
      
      return true;
    } catch (error) {
      console.error('Error al aplicar recompensas:', error);
      return false;
    }
  }
  
  // Encontrar la siguiente misión disponible
  findNextAvailableMission() {
    // Buscar misiones que cumplan los requisitos y no estén completadas
    const availableMissions = this.availableMissions.filter(mission => {
      // No debe estar completada
      if (this.completedMissions.includes(mission.id)) {
        return false;
      }
      
      // Debe cumplir los requisitos
      return this.checkMissionRequirements(mission);
    });
    
    // Si hay misiones disponibles, devolver la primera
    if (availableMissions.length > 0) {
      return availableMissions[0];
    }
    
    return null;
  }
  
  // Obtener la misión actual con todos sus detalles
  getCurrentMissionDetails() {
    if (!this.currentMission) {
      return null;
    }
    
    const mission = this.availableMissions.find(m => m.id === this.currentMission);
    
    if (!mission) {
      return null;
    }
    
    // Calcular progreso global de la misión
    const progress = this.missionProgress[this.currentMission];
    let completedObjectives = 0;
    let totalObjectives = mission.objectives.length;
    
    mission.objectives.forEach(obj => {
      const objProgress = progress.objectives[obj.id];
      if (objProgress && objProgress.completed) {
        completedObjectives++;
      }
    });
    
    const progressPercentage = Math.floor((completedObjectives / totalObjectives) * 100);
    
    return {
      ...mission,
      progress: progressPercentage,
      completedObjectives,
      totalObjectives,
      details: progress
    };
  }
  
  // Obtener todas las misiones con su estado
  getAllMissionsWithStatus() {
    return this.availableMissions.map(mission => {
      const isCurrent = this.currentMission === mission.id;
      const isCompleted = this.completedMissions.includes(mission.id);
      const isAvailable = !isCompleted && this.checkMissionRequirements(mission);
      
      let progressPercentage = 0;
      
      if (isCurrent && this.missionProgress[mission.id]) {
        const progress = this.missionProgress[mission.id];
        let completedObjectives = 0;
        let totalObjectives = mission.objectives.length;
        
        mission.objectives.forEach(obj => {
          const objProgress = progress.objectives[obj.id];
          if (objProgress && objProgress.completed) {
            completedObjectives++;
          }
        });
        
        progressPercentage = Math.floor((completedObjectives / totalObjectives) * 100);
      } else if (isCompleted) {
        progressPercentage = 100;
      }
      
      return {
        ...mission,
        isCurrent,
        isCompleted,
        isAvailable,
        progress: progressPercentage
      };
    });
  }
  
  // Verificar si se debe registrar una pista para alguna misión
  async checkClueForMissions(clue) {
    if (!this.currentMission) {
      return false;
    }
    
    const mission = this.availableMissions.find(m => m.id === this.currentMission);
    
    if (!mission) {
      return false;
    }
    
    let updated = false;
    
    // Verificar si algún objetivo está relacionado con encontrar pistas
    const findClueObjectives = mission.objectives.filter(obj => 
      obj.id === 'find-first-clue' || 
      obj.id === 'find-encoded-message' ||
      obj.id === 'find-foreign-text' ||
      obj.id === 'find-hidden-images'
    );
    
    for (const obj of findClueObjectives) {
      // Verificar si la pista coincide con el tipo de objetivo
      if (
        (obj.id === 'find-encoded-message' && clue.type === 'encoded-text') ||
        (obj.id === 'find-foreign-text' && clue.type === 'unusual-text') ||
        (obj.id === 'find-hidden-images' && clue.type === 'interesting-image') ||
        obj.id === 'find-first-clue'  // Este objetivo acepta cualquier tipo de pista
      ) {
        const result = await this.updateObjectiveProgress(obj.id);
        if (result) updated = true;
      }
    }
    
    return updated;
  }
}

// Exportar el gestor de misiones
window.MissionManager = MissionManager;