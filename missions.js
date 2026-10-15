// Sistema de misiones para Digital Treasure Hunters

class MissionManager {
  constructor() {
    this.currentMission = null;
    this.completedMissions = [];
    this.missionProgress = {};
    this.availableMissions = [];
    this.activeCampaigns = [];
    this.seasonalMissions = [];
    
    // Inicializar misiones predefinidas
    this.initializeMissions();
    this.initializeCampaigns();
    this.initializeSeasonalMissions();
  }
  
  // Inicializar el sistema de misiones
  async init() {
    try {
      // Cargar datos guardados
      const data = await chrome.storage.local.get(['currentMission', 'completedMissions', 'missionProgress', 'activeCampaigns']);
      
      if (data.currentMission) this.currentMission = data.currentMission;
      if (data.completedMissions) this.completedMissions = data.completedMissions;
      if (data.missionProgress) this.missionProgress = data.missionProgress;
      if (data.activeCampaigns) this.activeCampaigns = data.activeCampaigns;
      
      // Actualizar misiones estacionales
      this.updateSeasonalMissions();
      
      // Verificar si es necesario asignar una misión inicial
      if (!this.currentMission || typeof this.currentMission !== 'string') {
        await this.assignInitialMission();
      } else if (!this.missionProgress[this.currentMission]) {
        // Asegurar que exista el objeto de progreso para la misión actual
        await this.assignMission(this.currentMission);
      }
      
      return true;
    } catch (error) {
      console.error('Error al inicializar el gestor de misiones:', error);
      return false;
    }
  }
  
  // Inicializar campañas narrativas
  initializeCampaigns() {
    this.campaigns = {
      'the-digital-conspiracy': {
        id: 'the-digital-conspiracy',
        title: 'La Conspiración Digital',
        description: 'Una misteriosa organización está ocultando secretos en la web. Descubre la verdad.',
        chapters: [
          {
            id: 'chapter-1',
            title: 'Los Primeros Indicios',
            description: 'Algo extraño está sucediendo en la web. Las pistas están ahí, pero ¿quién las puso?',
            missions: ['mission-digital-traces', 'mission-hidden-messages']
          },
          {
            id: 'chapter-2', 
            title: 'La Red Oculta',
            description: 'Has descubierto que existe una red secreta. Ahora debes infiltrarte.',
            missions: ['mission-network-infiltration', 'mission-decode-manifesto']
          },
          {
            id: 'chapter-3',
            title: 'La Verdad Revelada',
            description: 'Finalmente, la verdad sobre la conspiración será revelada.',
            missions: ['mission-final-confrontation']
          }
        ]
      },
      'the-lost-civilization': {
        id: 'the-lost-civilization',
        title: 'La Civilización Perdida',
        description: 'Pistas de una civilización antigua han sido digitalizadas y escondidas en la web.',
        chapters: [
          {
            id: 'chapter-1',
            title: 'Los Fragmentos Antiguos',
            description: 'Encuentra los primeros fragmentos de una civilización perdida.',
            missions: ['mission-ancient-fragments', 'mission-decipher-glyphs']
          },
          {
            id: 'chapter-2',
            title: 'El Mapa del Tesoro',
            description: 'Los fragmentos revelan la ubicación de un tesoro perdido.',
            missions: ['mission-treasure-map', 'mission-guardian-trials']
          }
        ]
      }
    };
  }
  
  // Inicializar misiones estacionales
  initializeSeasonalMissions() {
    this.seasonalMissions = [
      {
        id: 'halloween-mysteries',
        title: 'Misterios de Halloween',
        description: 'Durante octubre, sitios web ocultan secretos espeluznantes.',
        activeMonths: [10], // Octubre
        difficulty: 'medio',
        objectives: [
          {
            id: 'find-spooky-clues',
            description: 'Encuentra 5 pistas relacionadas con Halloween',
            count: 0,
            required: 5
          }
        ]
      },
      {
        id: 'new-year-codes',
        title: 'Códigos de Año Nuevo',
        description: 'Los sitios web celebran con códigos especiales escondidos.',
        activeMonths: [12, 1], // Diciembre y Enero
        difficulty: 'fácil',
        objectives: [
          {
            id: 'find-celebration-codes',
            description: 'Descubre códigos de celebración del nuevo año',
            count: 0,
            required: 3
          }
        ]
      }
    ];
  }
  
  // Inicializar las misiones predefinidas (expandidas)
  initializeMissions() {
    this.availableMissions = [
      // === MISIONES TUTORIALES ===
      {
        id: 'mission-tutorial',
        title: 'Primeros pasos',
        description: 'Aprende los conceptos básicos de la búsqueda de tesoros digitales.',
        type: 'tutorial',
        difficulty: 'fácil',
        estimatedTime: '5 minutos',
        campaign: null,
        requirements: [],
        objectives: [
          {
            id: 'select-role',
            description: 'Selecciona un rol especializado',
            completed: false,
            type: 'action'
          },
          {
            id: 'find-first-clue',
            description: 'Encuentra tu primera pista',
            completed: false,
            count: 0,
            required: 1,
            type: 'clue-discovery'
          },
          {
            id: 'view-team-page',
            description: 'Visita la página de equipos',
            completed: false,
            type: 'navigation'
          }
        ],
        rewards: {
          xp: 100,
          title: 'Cazador Novato',
          unlocksRoles: []
        },
        hints: [
          'Usa el botón "Escanear esta página" para buscar pistas',
          'Cada rol tiene habilidades únicas de detección'
        ]
      },
      
      // === MISIONES BÁSICAS ORIGINALES ===
      {
        id: 'mission-team-up',
        title: 'Únete a la red',
        description: 'Forma parte de un equipo de cazadores de tesoros o crea el tuyo propio.',
        type: 'social',
        difficulty: 'fácil',
        estimatedTime: '10 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'join-team',
            description: 'Únete a un equipo existente o crea uno nuevo',
            completed: false,
            type: 'action'
          },
          {
            id: 'invite-member',
            description: 'Invita a un nuevo miembro a tu equipo',
            completed: false,
            type: 'action'
          }
        ],
        rewards: {
          xp: 200,
          teamBonus: true
        }
      },

      {
        id: 'mission-decoder-basics',
        title: 'El código oculto',
        description: 'Encuentra y descifra códigos ocultos en páginas web.',
        type: 'role-specific',
        forRole: 'decoder',
        difficulty: 'medio',
        estimatedTime: '15 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-encoded-message',
            description: 'Descubre 3 mensajes codificados en páginas web',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'decoder'
          },
          {
            id: 'decode-base64',
            description: 'Descifra un mensaje en formato Base64',
            completed: false,
            type: 'technique-mastery'
          }
        ],
        rewards: {
          xp: 300,
          unlocksTools: ['base64-decoder']
        }
      },

      {
        id: 'mission-translator-basics',
        title: 'Lenguas olvidadas',
        description: 'Descubre y traduce textos en idiomas poco comunes.',
        type: 'role-specific',
        forRole: 'translator',
        difficulty: 'medio',
        estimatedTime: '15 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-foreign-text',
            description: 'Descubre 3 textos en idiomas extranjeros',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'translator'
          },
          {
            id: 'identify-languages',
            description: 'Identifica correctamente 2 idiomas distintos',
            completed: false,
            count: 0,
            required: 2,
            type: 'role-specific',
            forRole: 'translator'
          }
        ],
        rewards: {
          xp: 300,
          unlocksTools: ['language-identifier']
        }
      },

      {
        id: 'mission-visual-basics',
        title: 'El ojo que todo lo ve',
        description: 'Encuentra pistas ocultas en imágenes y elementos visuales.',
        type: 'role-specific',
        forRole: 'visual-analyst',
        difficulty: 'medio',
        estimatedTime: '15 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-hidden-images',
            description: 'Descubre 3 imágenes con pistas ocultas',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'visual-analyst'
          },
          {
            id: 'identify-pattern',
            description: 'Identifica un patrón visual oculto',
            completed: false,
            type: 'role-specific',
            forRole: 'visual-analyst'
          }
        ],
        rewards: {
          xp: 300,
          unlocksTools: ['image-analyzer']
        }
      },

      {
        id: 'mission-forgeprojects-hq',
        title: 'El Cuartel General de ForgeProjects',
        description: 'Visita el centro de operaciones en forgeprojects.es para descubrir las directrices secretas de los Cazadores.',
        type: 'site-specific',
        targetSites: ['forgeprojects.es', 'localhost'],
        difficulty: 'fácil',
        estimatedTime: '10 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'scan-hq-page',
            description: 'Escanea la base de operaciones en forgeprojects.es/digital-treasure-hunters',
            completed: false,
            count: 0,
            required: 1,
            type: 'clue-discovery'
          },
          {
            id: 'find-hq-secret',
            description: 'Encuentra al menos 2 pistas ocultas en el portal de ForgeProjects',
            completed: false,
            count: 0,
            required: 2,
            type: 'clue-discovery'
          }
        ],
        rewards: {
          xp: 350,
          title: 'Agente de ForgeProjects',
          badge: 'forge-operative'
        }
      },

      // === MISIONES ESPECÍFICAS POR SITIO WEB ===
      {
        id: 'mission-wikipedia-scholar',
        title: 'El Erudito de Wikipedia',
        description: 'Wikipedia contiene secretos ocultos entre sus páginas de conocimiento.',
        type: 'site-specific',
        targetSites: ['wikipedia.org', 'es.wikipedia.org', 'en.wikipedia.org'],
        difficulty: 'medio',
        estimatedTime: '15 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-historical-references',
            description: 'Encuentra 3 referencias históricas significativas',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'historian'
          },
          {
            id: 'decode-wiki-secrets',
            description: 'Descifra códigos ocultos en páginas de Wikipedia',
            completed: false,
            count: 0,
            required: 2,
            type: 'role-specific',
            forRole: 'decoder'
          },
          {
            id: 'discover-multilingual-content',
            description: 'Identifica contenido en diferentes idiomas',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'translator'
          }
        ],
        rewards: {
          xp: 300,
          title: 'Erudito Digital',
          badge: 'wikipedia-expert'
        }
      },
      
      {
        id: 'mission-github-detective',
        title: 'El Detective de GitHub',
        description: 'Los repositorios de GitHub esconden secretos en su código y documentación.',
        type: 'site-specific',
        targetSites: ['github.com'],
        difficulty: 'difícil',
        estimatedTime: '20 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-hidden-comments',
            description: 'Encuentra comentarios ocultos en código',
            completed: false,
            count: 0,
            required: 5,
            type: 'role-specific',
            forRole: 'decoder'
          },
          {
            id: 'analyze-readme-patterns',
            description: 'Analiza patrones visuales en archivos README',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'visual-analyst'
          },
          {
            id: 'discover-repo-structure',
            description: 'Mapea la estructura de repositorios complejos',
            completed: false,
            count: 0,
            required: 2,
            type: 'role-specific',
            forRole: 'navigator'
          }
        ],
        rewards: {
          xp: 400,
          title: 'Detective de Código',
          badge: 'github-detective'
        }
      },
      
      {
        id: 'mission-news-investigator',
        title: 'El Investigador de Noticias',
        description: 'Los sitios de noticias ocultan información entre líneas.',
        type: 'site-specific',
        targetSites: ['bbc.com', 'cnn.com', 'elpais.com', 'elmundo.es'],
        difficulty: 'medio',
        estimatedTime: '10 minutos',
        requirements: ['mission-tutorial'],
        objectives: [
          {
            id: 'find-multilingual-articles',
            description: 'Encuentra artículos en diferentes idiomas sobre el mismo tema',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'translator'
          },
          {
            id: 'analyze-news-images',
            description: 'Analiza imágenes en artículos de noticias',
            completed: false,
            count: 0,
            required: 4,
            type: 'role-specific',
            forRole: 'visual-analyst'
          }
        ],
        rewards: {
          xp: 250,
          title: 'Investigador de Medios'
        }
      },
      
      // === MISIONES DE CAMPAÑA ===
      {
        id: 'mission-digital-traces',
        title: 'Rastros Digitales',
        description: 'Alguien ha dejado pistas deliberadamente en sitios web. Encuéntralas.',
        type: 'campaign',
        campaign: 'the-digital-conspiracy',
        chapter: 'chapter-1',
        difficulty: 'medio',
        estimatedTime: '25 minutos',
        requirements: ['mission-tutorial'],
        narrative: {
          intro: 'Has recibido un mensaje anónimo: "La verdad está oculta en la web. Busca los rastros digitales."',
          progress: 'Cada pista que encuentres te acerca más a la verdad...',
          completion: 'Has encontrado suficientes rastros. Alguien definitivamente está dejando pistas intencionalmente.'
        },
        objectives: [
          {
            id: 'find-mysterious-codes',
            description: 'Encuentra 5 códigos misteriosos en diferentes sitios web',
            completed: false,
            count: 0,
            required: 5,
            type: 'clue-discovery'
          },
          {
            id: 'decode-conspiracy-message',
            description: 'Descifra el mensaje oculto que forman los códigos',
            completed: false,
            type: 'puzzle-solving',
            requiresObjective: 'find-mysterious-codes'
          }
        ],
        rewards: {
          xp: 500,
          story: 'Has descubierto que existe una organización secreta comunicándose a través de la web.',
          unlocksNextChapter: true
        }
      },
      
      {
        id: 'mission-hidden-messages',
        title: 'Mensajes Ocultos',
        description: 'Los códigos revelan la existencia de mensajes más profundos.',
        type: 'campaign',
        campaign: 'the-digital-conspiracy',
        chapter: 'chapter-1',
        difficulty: 'difícil',
        estimatedTime: '30 minutos',
        requirements: ['mission-digital-traces'],
        narrative: {
          intro: 'Los rastros digitales han revelado algo inquietante: hay mensajes ocultos en sitios aparentemente normales.',
          progress: 'Cada mensaje descifrado revela más sobre la conspiración...',
          completion: 'Los mensajes hablan de una "Red Oculta" que opera desde las sombras de Internet.'
        },
        objectives: [
          {
            id: 'find-steganographic-images',
            description: 'Encuentra 3 imágenes que contengan mensajes ocultos',
            completed: false,
            count: 0,
            required: 3,
            type: 'role-specific',
            forRole: 'visual-analyst'
          },
          {
            id: 'decode-hidden-text',
            description: 'Descifra textos ocultos en comentarios HTML',
            completed: false,
            count: 0,
            required: 4,
            type: 'role-specific',
            forRole: 'decoder'
          },
          {
            id: 'translate-foreign-clues',
            description: 'Traduce pistas en idiomas extranjeros',
            completed: false,
            count: 0,
            required: 2,
            type: 'role-specific',
            forRole: 'translator'
          }
        ],
        rewards: {
          xp: 600,
          story: 'Has descubierto que la "Red Oculta" utiliza múltiples métodos de comunicación secreta.',
          unlocksTools: ['steganography-detector']
        }
      },
      
      // === MISIONES COOPERATIVAS AVANZADAS ===
      {
        id: 'mission-team-cipher',
        title: 'El Cifrado del Equipo',
        description: 'Un mensaje cifrado requiere las habilidades combinadas de todo el equipo.',
        type: 'team-advanced',
        difficulty: 'muy difícil',
        estimatedTime: '45 minutos',
        requirements: ['mission-team-up'],
        minTeamSize: 3,
        requiredRoles: ['decoder', 'translator', 'visual-analyst'],
        objectives: [
          {
            id: 'decode-layer-1',
            description: 'Descifra la primera capa del mensaje',
            completed: false,
            type: 'role-specific',
            forRole: 'decoder',
            teamwork: true
          },
          {
            id: 'translate-layer-2',
            description: 'Traduce la segunda capa revelada',
            completed: false,
            type: 'role-specific',
            forRole: 'translator',
            teamwork: true,
            requiresObjective: 'decode-layer-1'
          },
          {
            id: 'analyze-visual-layer',
            description: 'Analiza los patrones visuales de la capa final',
            completed: false,
            type: 'role-specific',
            forRole: 'visual-analyst',
            teamwork: true,
            requiresObjective: 'translate-layer-2'
          },
          {
            id: 'coordinate-solution',
            description: 'Coordina con el equipo para resolver el mensaje final',
            completed: false,
            type: 'team-coordination',
            requiresAllPrevious: true
          }
        ],
        rewards: {
          xp: 800,
          teamXp: 200,
          title: 'Maestro del Trabajo en Equipo',
          badge: 'team-cipher-master'
        }
      },
      
      // === MISIONES DE TIEMPO LIMITADO ===
      {
        id: 'mission-weekly-challenge',
        title: 'Desafío Semanal',
        description: 'Un desafío especial que cambia cada semana.',
        type: 'time-limited',
        difficulty: 'variable',
        estimatedTime: '20 minutos',
        requirements: ['mission-tutorial'],
        timeLimit: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
        objectives: [
          {
            id: 'weekly-clue-hunt',
            description: 'Encuentra pistas en sitios web específicos de esta semana',
            completed: false,
            count: 0,
            required: 10,
            type: 'clue-discovery'
          }
        ],
        rewards: {
          xp: 400,
          exclusiveReward: 'weekly-champion-badge'
        }
      },
      
      // === MISIONES ESPECÍFICAS POR ROL (EXPANDIDAS) ===
      {
        id: 'mission-decoder-mastery',
        title: 'Maestría del Decodificador',
        description: 'Domina todas las técnicas de decodificación avanzadas.',
        type: 'role-mastery',
        forRole: 'decoder',
        difficulty: 'muy difícil',
        estimatedTime: '60 minutos',
        requirements: ['mission-decoder-basics'],
        objectives: [
          {
            id: 'master-base64',
            description: 'Descifra 10 mensajes en Base64',
            completed: false,
            count: 0,
            required: 10,
            type: 'technique-mastery'
          },
          {
            id: 'master-caesar-cipher',
            description: 'Resuelve 5 cifrados César',
            completed: false,
            count: 0,
            required: 5,
            type: 'technique-mastery'
          },
          {
            id: 'master-hex-codes',
            description: 'Interpreta 15 códigos hexadecimales',
            completed: false,
            count: 0,
            required: 15,
            type: 'technique-mastery'
          },
          {
            id: 'solve-master-puzzle',
            description: 'Resuelve el rompecabezas maestro de decodificación',
            completed: false,
            type: 'final-challenge',
            requiresAllPrevious: true
          }
        ],
        rewards: {
          xp: 1000,
          title: 'Maestro Decodificador',
          badge: 'decoder-master',
          unlocksTools: ['advanced-cipher-kit']
        }
      },
      
      // === MISIONES DE INVESTIGACIÓN MULTI-SITIO ===
      {
        id: 'mission-cross-site-investigation',
        title: 'Investigación Multi-Sitio',
        description: 'Una investigación que requiere conectar pistas de múltiples sitios web.',
        type: 'investigation',
        difficulty: 'difícil',
        estimatedTime: '40 minutos',
        requirements: ['mission-tutorial'],
        targetSites: ['multiple'],
        objectives: [
          {
            id: 'collect-evidence-wikipedia',
            description: 'Recolecta evidencia en Wikipedia',
            completed: false,
            count: 0,
            required: 3,
            type: 'site-specific',
            site: 'wikipedia.org'
          },
          {
            id: 'collect-evidence-github',
            description: 'Recolecta evidencia en GitHub',
            completed: false,
            count: 0,
            required: 2,
            type: 'site-specific',
            site: 'github.com'
          },
          {
            id: 'collect-evidence-news',
            description: 'Recolecta evidencia en sitios de noticias',
            completed: false,
            count: 0,
            required: 2,
            type: 'site-specific',
            site: 'news-sites'
          },
          {
            id: 'connect-evidence',
            description: 'Conecta toda la evidencia para resolver el caso',
            completed: false,
            type: 'analysis',
            requiresAllPrevious: true
          }
        ],
        rewards: {
          xp: 700,
          title: 'Investigador Digital',
          badge: 'cross-site-detective'
        }
      }
    ];
  }
  
  // Actualizar misiones estacionales
  updateSeasonalMissions() {
    const currentMonth = new Date().getMonth() + 1;
    
    this.seasonalMissions.forEach(mission => {
      if (mission.activeMonths.includes(currentMonth)) {
        // Añadir misión estacional a las disponibles si no está ya
        const exists = this.availableMissions.find(m => m.id === mission.id);
        if (!exists) {
          this.availableMissions.push(mission);
        }
      }
    });
  }
  
  // Asignar misión inicial
  async assignInitialMission() {
    const tutorialMission = this.availableMissions.find(m => m.id === 'mission-tutorial');
    if (tutorialMission) {
      await this.assignMission(tutorialMission.id);
    }
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
    const basicRequirements = mission.requirements.every(reqMissionId => 
      this.completedMissions.includes(reqMissionId)
    );
    
    if (!basicRequirements) return false;
    
    // Verificar requisitos específicos por rol
    if (mission.forRole) {
      // Esta verificación se haría con el rol actual del jugador
      // Por ahora asumimos que se cumple si el rol coincide
    }
    
    // Verificar requisitos de equipo para misiones cooperativas
    if (mission.type === 'team-advanced') {
      if (mission.minTeamSize && mission.requiredRoles) {
        // En una implementación real, verificar tamaño del equipo y roles
        return true; // Placeholder por ahora
      }
    }
    
    // Verificar misiones de tiempo limitado
    if (mission.type === 'time-limited' && mission.timeLimit) {
      const missionProgress = this.missionProgress[mission.id];
      if (missionProgress && missionProgress.started) {
        const timeElapsed = Date.now() - missionProgress.started;
        if (timeElapsed > mission.timeLimit) {
          return false; // Misión expirada
        }
      }
    }
    
    return true;
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
      const mission = this.availableMissions.find(m => m.id === missionId);
      if (!mission) return false;
      
      // Añadir a misiones completadas
      if (!this.completedMissions.includes(missionId)) {
        this.completedMissions.push(missionId);
      }
      
      // Quitar de misión actual si es la actual
      if (this.currentMission === missionId) {
        this.currentMission = null;
      }
      
      // Mostrar narrativa de finalización si existe
      if (mission.narrative && mission.narrative.completion) {
        console.log('Narrativa de finalización:', mission.narrative.completion);
      }
      
      // Aplicar recompensas
      await this.applyMissionRewards(missionId);
      
      // Manejar progression de campaña
      if (mission.type === 'campaign' && mission.campaign) {
        await this.handleCampaignProgression(mission);
      }
      
      // Guardar cambios
      await chrome.storage.local.set({
        currentMission: this.currentMission,
        completedMissions: this.completedMissions,
        activeCampaigns: this.activeCampaigns
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
  
  // Verificar si una pista puede contribuir a alguna misión
  async checkClueForMissions(clue, currentUrl) {
    try {
      if (!this.currentMission) {
        return false;
      }
      
      const mission = this.availableMissions.find(m => m.id === this.currentMission);
      
      if (!mission) {
        return false;
      }
      
      // Verificar si la pista es válida para el sitio actual (para misiones específicas por sitio)
      if (!this.isCurrentSiteValidForMission(mission, currentUrl)) {
        return false;
      }
      
      let progressMade = false;
      
      // Buscar objetivos que coincidan con el tipo de pista
      for (const objective of mission.objectives) {
        const progress = this.missionProgress[this.currentMission].objectives[objective.id];
        
        if (progress.completed) continue;
        
        let shouldProgress = false;
        
        // Diferentes tipos de objetivos
        switch (objective.type) {
          case 'clue-discovery':
            shouldProgress = true;
            break;
            
          case 'role-specific':
            shouldProgress = this.isClueValidForRoleObjective(clue, objective);
            break;
            
          case 'site-specific':
            shouldProgress = this.isClueValidForSiteObjective(clue, objective, currentUrl);
            break;
            
          case 'technique-mastery':
            shouldProgress = this.isClueValidForTechniqueObjective(clue, objective);
            break;
            
          default:
            // Compatibilidad con objetivos legacy
            shouldProgress = this.isClueValidForLegacyObjective(clue, objective);
            break;
        }
        
        if (shouldProgress) {
          await this.updateObjectiveProgress(objective.id, 1);
          progressMade = true;
        }
      }
      
      return progressMade;
    } catch (error) {
      console.error('Error al verificar pista para misiones:', error);
      return false;
    }
  }

  // Verificar si el sitio actual es válido para la misión
  isCurrentSiteValidForMission(mission, currentUrl) {
    if (!mission.targetSites || mission.targetSites.includes('multiple')) {
      return true; // Misión no específica de sitio o multi-sitio
    }
    
    if (!currentUrl) return false;
    
    try {
      const hostname = new URL(currentUrl).hostname.toLowerCase();
      
      return mission.targetSites.some(site => {
        return hostname.includes(site.toLowerCase());
      });
    } catch (e) {
      return false;
    }
  }

  // Verificar si la pista es válida para un objetivo específico de rol
  isClueValidForRoleObjective(clue, objective) {
    if (!objective.forRole || !clue.type) return false;
    
    const roleClueTypes = {
      'decoder': ['base64-text', 'hex-codes', 'caesar-cipher', 'hidden-comment', 'number-patterns', 'encoded-text'],
      'translator': ['non-latin-script', 'foreign-language', 'language-codes', 'html-lang-attributes', 'unusual-diacritics', 'unusual-text'],
      'visual-analyst': ['suspicious-images', 'hidden-elements', 'color-cipher', 'css-transformations', 'background-patterns', 'interesting-image'],
      'historian': ['historical-dates', 'historical-events', 'historical-figures', 'civilizations', 'historical-periods'],
      'navigator': ['complex-navigation', 'url-patterns', 'site-structure', 'hidden-routes', 'domain-patterns']
    };
    
    const validTypes = roleClueTypes[objective.forRole] || [];
    return validTypes.includes(clue.type);
  }

  // Verificar si la pista es válida para un objetivo específico de sitio
  isClueValidForSiteObjective(clue, objective, currentUrl) {
    if (!objective.site || !currentUrl) return false;
    
    try {
      const hostname = new URL(currentUrl).hostname.toLowerCase();
      
      if (objective.site === 'news-sites') {
        const newsSites = ['bbc.com', 'cnn.com', 'elpais.com', 'elmundo.es', 'reuters.com'];
        return newsSites.some(site => hostname.includes(site));
      }
      
      return hostname.includes(objective.site.toLowerCase());
    } catch (e) {
      return false;
    }
  }

  // Verificar si la pista es válida para un objetivo de maestría técnica
  isClueValidForTechniqueObjective(clue, objective) {
    const techniqueMapping = {
      'master-base64': ['base64-text'],
      'master-caesar-cipher': ['caesar-cipher'],
      'master-hex-codes': ['hex-codes'],
      'find-steganographic-images': ['suspicious-images'],
      'decode-hidden-text': ['hidden-comment'],
      'translate-foreign-clues': ['foreign-language', 'non-latin-script']
    };
    
    const validTypes = techniqueMapping[objective.id] || [];
    return validTypes.includes(clue.type);
  }

  // Verificar compatibilidad con objetivos legacy
  isClueValidForLegacyObjective(clue, objective) {
    const legacyMappings = {
      'find-first-clue': () => true, // Acepta cualquier pista
      'find-encoded-message': () => ['encoded-text', 'base64-text', 'hex-codes'].includes(clue.type),
      'find-foreign-text': () => ['unusual-text', 'foreign-language', 'non-latin-script'].includes(clue.type),
      'find-hidden-images': () => ['interesting-image', 'suspicious-images'].includes(clue.type)
    };
    
    const checker = legacyMappings[objective.id];
    return checker ? checker() : false;
  }

  // Manejar progresión de campaña
  async handleCampaignProgression(mission) {
    try {
      const campaign = this.campaigns[mission.campaign];
      if (!campaign) return;
      
      const currentChapter = campaign.chapters.find(ch => ch.id === mission.chapter);
      if (!currentChapter) return;
      
      // Verificar si todas las misiones del capítulo actual están completadas
      const chapterMissions = currentChapter.missions;
      const completedChapterMissions = chapterMissions.filter(missionId => 
        this.completedMissions.includes(missionId)
      );
      
      if (completedChapterMissions.length === chapterMissions.length) {
        // Capítulo completado, desbloquear siguiente capítulo
        const chapterIndex = campaign.chapters.findIndex(ch => ch.id === mission.chapter);
        const nextChapter = campaign.chapters[chapterIndex + 1];
        
        if (nextChapter) {
          console.log(`Capítulo completado! Desbloqueando: ${nextChapter.title}`);
          this.unlockChapterMissions(nextChapter);
        } else {
          console.log(`¡Campaña completada! ${campaign.title}`);
          await this.completeCampaign(campaign.id);
        }
      }
    } catch (error) {
      console.error('Error al manejar progresión de campaña:', error);
    }
  }

  // Desbloquear misiones de un capítulo
  unlockChapterMissions(chapter) {
    console.log(`Misiones desbloqueadas del capítulo: ${chapter.title}`);
    // En una implementación real, aquí se marcarían las misiones como disponibles
  }

  // Completar una campaña
  async completeCampaign(campaignId) {
    try {
      if (!this.activeCampaigns.includes(campaignId)) {
        this.activeCampaigns.push(campaignId);
      }
      
      const campaign = this.campaigns[campaignId];
      console.log(`¡Campaña completada: ${campaign.title}!`);
      
      await chrome.storage.local.set({
        activeCampaigns: this.activeCampaigns
      });
    } catch (error) {
      console.error('Error al completar campaña:', error);
    }
  }

  // Obtener narrativa actual de la misión
  getCurrentNarrative() {
    if (!this.currentMission) return null;
    
    const mission = this.availableMissions.find(m => m.id === this.currentMission);
    if (!mission || !mission.narrative) return null;
    
    const progress = this.missionProgress[this.currentMission];
    const totalObjectives = mission.objectives.length;
    const completedObjectives = Object.values(progress.objectives).filter(obj => obj.completed).length;
    
    if (completedObjectives === 0) {
      return mission.narrative.intro;
    } else if (completedObjectives === totalObjectives) {
      return mission.narrative.completion;
    } else {
      return mission.narrative.progress;
    }
  }

  // Obtener misiones disponibles por tipo
  getMissionsByType(type) {
    return this.availableMissions.filter(mission => {
      return mission.type === type && 
             !this.completedMissions.includes(mission.id) &&
             this.checkMissionRequirements(mission);
    });
  }

  // Obtener estadísticas del jugador
  getPlayerStats() {
    const totalMissions = this.availableMissions.length;
    const completedCount = this.completedMissions.length;
    const completionRate = totalMissions > 0 ? (completedCount / totalMissions) * 100 : 0;
    
    return {
      totalMissions,
      completedCount,
      completionRate: Math.round(completionRate),
      activeCampaigns: this.activeCampaigns.length
    };
  }
}

// Exportar el gestor de misiones (compatible con ventana y Service Worker)
const globalScope = typeof self !== 'undefined' ? self : window;
globalScope.MissionManager = MissionManager;