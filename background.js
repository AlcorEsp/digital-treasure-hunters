// Background Script para Digital Treasure Hunters
// Este script se ejecuta en segundo plano continuamente (Service Worker MV3)

importScripts('missions.js', 'teams.js');

// Configuracion de la plataforma en ForgeProjects
const GAME_CONFIG = {
  hubUrl: 'https://www.forgeprojects.es/digital-treasure-hunters/',
  apiBaseUrl: 'https://www.forgeprojects.es/digital-treasure-hunters/api/'
};

// Clase principal para gestionar la lógica del juego
class TreasureHunterGame {
  constructor() {
    // Estado del juego
    this.currentUser = {
      id: 'user_local',
      name: 'Cazador',
      role: null,
      team: null,
      xp: 0,
      tools: [],
      achievements: [],
      discoveredClues: []
    };

    this.missionManager = new self.MissionManager();
    this.teamManager = new self.TeamManager();

    // Inicializar listeners
    this.initEventListeners();

    // Cargar datos guardados
    this.loadSavedData();
  }

  // Inicializar listeners para eventos
  initEventListeners() {
    // Escuchar mensajes de la extensión
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(response => sendResponse(response))
        .catch(err => {
          console.error('Error procesando mensaje:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Respuesta asíncrona
    });

    // Al instalar la extensión
    chrome.runtime.onInstalled.addListener(details => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else {
        this.loadSavedData();
      }
    });

    // Al navegar a una nueva página
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        this.handlePageNavigation(tabId, tab.url);
      }
    });
  }

  async handleMessage(message, sender) {
    await this.loadSavedData();

    switch (message.action) {
      case 'roleSelected':
        await this.handleRoleSelection(message.role);
        return { success: true };

      case 'clueDiscovered':
        await this.handleClueDiscovery(
          message.clue,
          message.currentUrl || (sender.tab && sender.tab.url) || ''
        );
        return { success: true };

      case 'cluesBatchDiscovered':
        const result = await this.handleCluesBatch(
          message.clues || [],
          message.currentUrl || (sender.tab && sender.tab.url) || ''
        );
        return { success: true, ...result };

      case 'joinTeam':
      case 'teamJoined':
        await this.handleJoinTeam(message.teamId);
        return { success: true };

      case 'teamPageVisited':
        await this.missionManager.init();
        await this.missionManager.completeObjective('view-team-page');
        return { success: true };

      case 'openRoleSelection':
        await this.openRoleSelection();
        return { success: true };

      case 'createRivalChallenge':
        return await this.handleCreateRivalChallenge(message.targetData, sender.tab);

      case 'solveRivalChallenge':
        return await this.handleSolveRivalChallenge(message.challengeId);

      case 'syncChallenges':
        return await this.syncChallengesFromHub();

      default:
        return { success: false, error: 'Acción desconocida' };
    }
  }

  // === SISTEMA COMPETITIVO ALPHA VS BETA (CAPTURA + IA GRATUITA) ===

  // Recortar la captura de pantalla alrededor del elemento seleccionado usando OffscreenCanvas
  async cropScreenshot(dataUrl, rect) {
    try {
      if (!dataUrl || typeof OffscreenCanvas === 'undefined') return dataUrl;
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const dpr = rect.devicePixelRatio || 1;
      const pad = 40 * dpr;
      const sx = Math.max(0, Math.round(rect.x * dpr - pad));
      const sy = Math.max(0, Math.round(rect.y * dpr - pad));
      const sw = Math.min(bitmap.width - sx, Math.round(rect.width * dpr + pad * 2));
      const sh = Math.min(bitmap.height - sy, Math.round(rect.height * dpr + pad * 2));

      if (sw <= 10 || sh <= 10) return dataUrl;

      const maxOutWidth = 420;
      const scale = Math.min(1, maxOutWidth / sw);
      const outW = Math.max(80, Math.round(sw * scale));
      const outH = Math.max(80, Math.round(sh * scale));

      const canvas = new OffscreenCanvas(outW, outH);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);

      const croppedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(croppedBlob);
      });
    } catch (e) {
      console.warn('No se pudo recortar la captura, usando captura completa:', e);
      return dataUrl;
    }
  }

  // Generador de pistas de respaldo determinista (por si no hay red o la IA tarda)
  buildFallbackClues(targetData) {
    const hostParts = (targetData.hostname || 'web').replace(/^www\./, '').split('.');
    const mainDomain = hostParts[0] || 'sitio';
    const tld = hostParts.slice(1).join('.') || 'com';
    const b64Domain = btoa(unescape(encodeURIComponent(mainDomain)));
    const firstHeading = (targetData.context && targetData.context.headings && targetData.context.headings[0]) || targetData.pageTitle;
    const yearsList = (targetData.context && targetData.context.years && targetData.context.years.length > 0)
      ? targetData.context.years.join(', ')
      : 'ninguna fecha explícita';

    return {
      'decoder': `Código interceptado del dominio objetivo (Base64): "${b64Domain}". Descífralo para obtener el nombre del portal.`,
      'navigator': `El objetivo se esconde en un dominio terminado en ".${tld}" con ruta de ${targetData.pathname.split('/').filter(Boolean).length} nivel(es) y ${targetData.context?.linksCount || 0} enlaces activos.`,
      'historian': `La página trata sobre "${firstHeading.substring(0, 50)}" y menciona referencias temporales como: ${yearsList}.`,
      'translator': `Idioma base del documento: "${targetData.context?.lang || 'es'}". El texto oculto contiene ${targetData.elementText.split(/\s+/).length} palabras y empieza por "${targetData.elementText.substring(0, 18)}...".`,
      'visual-analyst': `El equipo rival capturó un elemento <${targetData.elementTag}> de ${targetData.rect.width}x${targetData.rect.height}px. Observa el recorte visual adjunto para localizarlo.`
    };
  }

  // Generar 5 pistas por rol usando IA 100% gratuita (Pollinations AI sin API Key)
  async generateAIClues(targetData) {
    const fallback = this.buildFallbackClues(targetData);

    try {
      const prompt = `Eres el Director de Juego de "Digital Treasure Hunters". Un equipo acaba de esconder un objetivo en una página web y el equipo rival debe encontrar la página y hacer clic en ese elemento.
Datos reales del objetivo:
- Dominio: ${targetData.hostname}
- Ruta URL: ${targetData.pathname}
- Título de la página: ${targetData.pageTitle}
- Encabezados principales: ${(targetData.context?.headings || []).join(' | ')}
- Fechas en la página: ${(targetData.context?.years || []).join(', ')}
- Elemento capturado (<${targetData.elementTag}>): "${targetData.elementText.substring(0, 120)}"

Genera un JSON válido (sin bloques markdown, SOLO el objeto JSON) con 5 pistas en español ingeniosas pero resolubles, una para cada rol del equipo buscador (no escribas la URL completa directa, da acertijos o fragmentos codificados para que colaboren):
{
  "decoder": "Acertijo con una palabra clave del dominio o ruta codificada en Base64 o cifrado César",
  "navigator": "Pista sobre el tipo de sitio web, estructura de su URL, dominio o cómo llegar navegando",
  "historian": "Pista sobre la temática, contexto cultural/histórico o fechas mencionadas en esa página",
  "translator": "Pista lingüística traduciendo una frase clave del título o del elemento a otro idioma o explicando su semántica",
  "visual-analyst": "Descripción visual de la zona de la página y qué tipo de elemento (<${targetData.elementTag}>) deben buscar"
}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Responde únicamente con un objeto JSON válido con las claves decoder, navigator, historian, translator, visual-analyst.' },
            { role: 'user', content: prompt }
          ],
          model: 'openai',
          jsonMode: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const rawText = await response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            'decoder': parsed.decoder || fallback['decoder'],
            'navigator': parsed.navigator || fallback['navigator'],
            'historian': parsed.historian || fallback['historian'],
            'translator': parsed.translator || fallback['translator'],
            'visual-analyst': parsed['visual-analyst'] || parsed.visualAnalyst || fallback['visual-analyst']
          };
        }
      }
    } catch (err) {
      console.warn('Usando pistas de respaldo locales:', err.message);
    }

    return fallback;
  }

  async handleCreateRivalChallenge(targetData, tab) {
    try {
      // 1. Tomar captura de la pestaña actual
      let screenshotUrl = null;
      try {
        const windowId = tab ? tab.windowId : null;
        const fullCapture = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 65 });
        screenshotUrl = await this.cropScreenshot(fullCapture, targetData.rect);
      } catch (capErr) {
        console.warn('No se pudo capturar imagen de la pestaña:', capErr);
      }

      // 2. Generar las 5 pistas por rol con IA gratuita
      const roleClues = await this.generateAIClues(targetData);

      const activeTeam = targetData.teamId || this.currentUser.team || 'team-alpha';
      const rivalTeam = activeTeam === 'team-beta' ? 'team-alpha' : 'team-beta';

      const challenge = {
        id: 'challenge_' + Date.now(),
        createdAt: Date.now(),
        teamId: activeTeam,
        targetTeamId: rivalTeam,
        createdBy: this.currentUser.name || 'Agente',
        status: 'active',
        url: targetData.url,
        hostname: targetData.hostname,
        pathname: targetData.pathname,
        pageTitle: targetData.pageTitle,
        selector: targetData.selector,
        elementTag: targetData.elementTag,
        elementText: targetData.elementText,
        elementSrc: targetData.elementSrc,
        screenshot: screenshotUrl,
        clues: roleClues
      };

      // 3. Guardar localmente en chrome.storage.local
      const store = await chrome.storage.local.get(['challenges', 'teamScores']);
      const challenges = store.challenges || [];
      challenges.unshift(challenge);
      const teamScores = store.teamScores || { 'team-alpha': 0, 'team-beta': 0 };

      await chrome.storage.local.set({
        challenges: challenges.slice(0, 20),
        teamScores
      });

      // 4. Sincronizar con el Control de Mando en forgeprojects.es (si está accesible)
      fetch(`${GAME_CONFIG.apiBaseUrl}?action=createChallenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge })
      }).catch(() => {});

      this.showNotification(
        '🎯 ¡Objetivo escondido con éxito!',
        `La IA ha generado 5 pistas para el ${rivalTeam === 'team-beta' ? 'Equipo Beta' : 'Equipo Alpha'}.`
      );

      return { success: true, challenge };
    } catch (error) {
      console.error('Error creando reto:', error);
      return { success: false, error: error.message };
    }
  }

  async handleSolveRivalChallenge(challengeId) {
    try {
      const store = await chrome.storage.local.get(['challenges', 'teamScores', 'user']);
      const challenges = store.challenges || [];
      const teamScores = store.teamScores || { 'team-alpha': 0, 'team-beta': 0 };

      const idx = challenges.findIndex(c => c.id === challengeId);
      const solverTeam = this.currentUser.team || 'team-beta';

      if (idx !== -1 && challenges[idx].status !== 'solved') {
        challenges[idx].status = 'solved';
        challenges[idx].solvedAt = Date.now();
        challenges[idx].solvedByTeam = solverTeam;
      }

      teamScores[solverTeam] = (teamScores[solverTeam] || 0) + 1;
      this.currentUser.xp = (this.currentUser.xp || 0) + 500;

      await chrome.storage.local.set({
        challenges,
        teamScores,
        user: this.currentUser
      });

      // Sincronizar victoria con el servidor en forgeprojects.es
      fetch(`${GAME_CONFIG.apiBaseUrl}?action=solveChallenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, solverTeam })
      }).catch(() => {});

      this.showNotification(
        '🏆 ¡Objetivo Rival Localizado!',
        `+1 Punto para ${solverTeam === 'team-beta' ? 'Equipo Beta' : 'Equipo Alpha'} y +500 XP.`
      );

      return { success: true, teamScores };
    } catch (error) {
      console.error('Error al resolver reto:', error);
      return { success: false, error: error.message };
    }
  }

  async syncChallengesFromHub() {
    try {
      const res = await fetch(`${GAME_CONFIG.apiBaseUrl}?action=challenges`);
      if (!res.ok) return { success: false };
      const data = await res.json();
      if (data && data.success && Array.isArray(data.challenges)) {
        const localStore = await chrome.storage.local.get(['challenges', 'teamScores']);
        const localChallenges = localStore.challenges || [];
        const mergedMap = new Map();
        [...data.challenges, ...localChallenges].forEach(ch => mergedMap.set(ch.id, ch));
        const merged = Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
        const scores = data.teamScores || localStore.teamScores || { 'team-alpha': 0, 'team-beta': 0 };
        await chrome.storage.local.set({ challenges: merged, teamScores: scores });
        return { success: true, challenges: merged, teamScores: scores };
      }
    } catch (e) {
      // Silencioso si el servidor aún no está subido
    }
    return { success: false };
  }

  // Abrir la selección de rol
  async openRoleSelection() {
    await chrome.storage.local.set({ showRoleSelection: true });
  }

  // Cargar y sincronizar datos guardados
  async loadSavedData() {
    try {
      const data = await chrome.storage.local.get(['user', 'role', 'clues', 'currentTeam']);

      if (data.user) {
        this.currentUser = { ...this.currentUser, ...data.user };
      }

      // Sincronizar en caso de que 'role' o 'clues' se hayan guardado en la raíz
      if (data.role && !this.currentUser.role) {
        this.currentUser.role = data.role;
      }
      if (data.clues && (!this.currentUser.discoveredClues || this.currentUser.discoveredClues.length === 0)) {
        this.currentUser.discoveredClues = data.clues;
      }
      if (data.currentTeam) {
        this.currentUser.team = data.currentTeam;
      }

      await this.missionManager.init();
      await this.teamManager.init();
    } catch (error) {
      console.error('Error al cargar datos guardados:', error);
    }
  }

  // Manejar la primera instalación
  async handleFirstInstall() {
    await this.missionManager.init();
    await this.teamManager.init();

    // Inicializar datos del usuario
    await chrome.storage.local.set({
      user: this.currentUser,
      role: null,
      clues: [],
      onboarded: false,
      gameConfig: GAME_CONFIG
    });

    // Mostrar página de bienvenida
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  }

  // Manejar selección de rol
  async handleRoleSelection(role) {
    console.log(`Rol seleccionado: ${role}`);

    // Actualizar el rol del usuario en ambas estructuras para compatibilidad total
    this.currentUser.role = role;
    await chrome.storage.local.set({
      user: this.currentUser,
      role: role
    });

    // Inicializar gestor de misiones y marcar el objetivo de seleccionar rol
    await this.missionManager.init();
    await this.missionManager.completeObjective('select-role');

    const missionDetails = this.missionManager.getCurrentMissionDetails();
    if (missionDetails) {
      this.showNotification(
        'Rol asignado y misión activa',
        `${missionDetails.title}: ${missionDetails.description}`
      );
    }
  }

  // Manejar un lote de pistas escaneadas desde popup o página
  async handleCluesBatch(clues, sourceUrl) {
    if (!clues || clues.length === 0) {
      return { addedCount: 0 };
    }

    await this.missionManager.init();

    // Evitar duplicados exactos (mismo contenido y misma URL)
    const existingKeys = new Set(
      (this.currentUser.discoveredClues || []).map(c => `${c.type}|${c.content}|${c.source}`)
    );

    let addedCount = 0;
    let missionUpdated = false;

    for (const clue of clues) {
      clue.source = clue.source || sourceUrl;
      clue.timestamp = clue.timestamp || Date.now();
      clue.discoveredAt = clue.discoveredAt || clue.timestamp;

      const key = `${clue.type}|${clue.content}|${clue.source}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        this.currentUser.discoveredClues.unshift(clue);
        addedCount++;
      }

      // Verificar si la pista contribuye a la misión actual
      const progressed = await this.missionManager.checkClueForMissions(clue, clue.source);
      if (progressed) {
        missionUpdated = true;
      }
    }

    // Guardar en ambas claves ('user' y 'clues')
    await chrome.storage.local.set({
      user: this.currentUser,
      clues: this.currentUser.discoveredClues
    });

    return {
      addedCount,
      missionUpdated,
      totalClues: this.currentUser.discoveredClues.length
    };
  }

  // Manejar descubrimiento individual de pista (ej. clic en marcador de la página)
  async handleClueDiscovery(clue, sourceUrl) {
    const result = await this.handleCluesBatch([clue], sourceUrl);
    if (result.addedCount > 0) {
      this.showNotification('¡Nueva pista descubierta!', clue.content);
    }
  }

  // Manejar unirse a un equipo
  async handleJoinTeam(teamId) {
    await this.teamManager.init();
    await this.missionManager.init();

    this.currentUser.team = teamId;
    await chrome.storage.local.set({ user: this.currentUser });

    // Completar objetivo de unirse a un equipo si está activo
    await this.missionManager.completeObjective('join-team');

    const team = this.teamManager.getCurrentTeam();
    if (team) {
      this.showNotification(
        '¡Equipo actualizado!',
        `Ahora formas parte de ${team.name}.`
      );
    }
  }

  // Manejar navegación a una nueva página
  async handlePageNavigation(tabId, url) {
    try {
      await this.loadSavedData();
      const missionDetails = this.missionManager.getCurrentMissionDetails();

      if (this.currentUser.role && missionDetails) {
        chrome.tabs.sendMessage(tabId, {
          action: 'checkPage',
          role: this.currentUser.role,
          mission: missionDetails
        }).catch(() => {
          // Es normal que falle en páginas internas del navegador (chrome://, etc.)
        });
      }
    } catch (error) {
      console.error('Error al manejar navegación:', error);
    }
  }

  // Mostrar una notificación del sistema
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
