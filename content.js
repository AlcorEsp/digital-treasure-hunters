// Digital Treasure Hunters - Content Script
// Este script se ejecuta en cada página web que el usuario visita

// Clase principal para la lógica del juego en la página
class TreasureHunterPageScanner {
  constructor() {
    this.currentRole = null;
    this.clueGenerators = {
      'decoder': this.generateDecoderClues.bind(this),
      'translator': this.generateTranslatorClues.bind(this),
      'visual-analyst': this.generateVisualAnalystClues.bind(this),
      'historian': this.generateHistorianClues.bind(this),
      'navigator': this.generateNavigatorClues.bind(this)
    };
    
    // Inicializar listeners de mensajes
    this.initMessageListeners();
    
    // Comprobar si hay elementos visuales que añadir
    this.checkForVisualElements();
  }
  
  // Inicializar listeners para comunicación con el popup y background
  initMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Si el mensaje es para escanear la página
      if (message.action === 'scanPage') {
        this.currentRole = message.role;
        const clues = this.scanPageForClues();
        sendResponse({ clues });
        return true; // Necesario para respuestas asíncronas
      }
      
      // Si el mensaje es para comprobar la página para una misión específica
      if (message.action === 'checkPage') {
        this.currentRole = message.role;
        this.checkPageForMission(message.mission);
        sendResponse({ success: true });
        return true;
      }
    });
  }
  
  // Comprobar si la página está relacionada con una misión específica
  checkPageForMission(mission) {
    if (!mission) return;
    
    // En una implementación real, aquí se comprobaría si la página
    // es relevante para la misión actual y se añadirían elementos visuales
    // o pistas específicas de la misión
    
    // Por ahora, simplemente registramos la información
    console.log(`Comprobando página para misión: ${mission.id}`);
  }
  
  // Escanear la página en busca de pistas según el rol
  scanPageForClues() {
    if (!this.currentRole || !this.clueGenerators[this.currentRole]) {
      console.warn('Rol no válido para generar pistas');
      return [];
    }
    
    // Generar pistas según el rol actual del usuario
    return this.clueGenerators[this.currentRole]();
  }
  
  // Métodos para generar pistas según cada rol
  generateDecoderClues() {
    const clues = [];
    
    // Buscar elementos que podrían contener códigos ocultos
    // En una implementación real, esto tendría algoritmos más sofisticados
    
    // Ejemplo: Buscar cadenas que parezcan codificadas en Base64
    const base64Regex = /[A-Za-z0-9+/]{20,}={0,2}/g;
    const pageText = document.body.innerText;
    const matches = pageText.match(base64Regex);
    
    if (matches) {
      matches.forEach(match => {
        // Limitar a un máximo de 3 pistas por página
        if (clues.length < 3) {
          clues.push({
            type: 'encoded-text',
            content: `Posible texto codificado: "${match.substring(0, 30)}..."`,
            source: window.location.href,
            timestamp: Date.now()
          });
        }
      });
    }
    
    // Buscar comentarios en el HTML que podrían contener pistas
    const htmlContent = document.documentElement.outerHTML;
    const commentRegex = /<!--(.+?)-->/g;
    const commentMatches = htmlContent.matchAll(commentRegex);
    
    for (const match of commentMatches) {
      if (clues.length < 5 && match[1].trim().length > 10) { // Solo pistas de cierto tamaño
        clues.push({
          type: 'hidden-comment',
          content: `Comentario oculto encontrado: "${match[1].trim().substring(0, 50)}..."`,
          source: window.location.href,
          timestamp: Date.now()
        });
      }
    }
    
    return clues;
  }
  
  generateTranslatorClues() {
    const clues = [];
    
    // Buscar textos en idiomas poco comunes
    const allParagraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
    const processedTexts = new Set(); // Evitar duplicados
    
    allParagraphs.forEach(el => {
      const text = el.innerText.trim();
      
      // Evitar textos ya procesados o muy cortos
      if (text.length < 20 || processedTexts.has(text)) return;
      processedTexts.add(text);
      
      // En una implementación real, aquí habría detección de idioma
      // Por ahora, simulamos encontrar textos "interesantes"
      
      // Ejemplos de patrones que podrían ser interesantes para un traductor
      const hasSpecialCharacters = /[α-ωΑ-Ω\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g.test(text);
      const hasUnusualSymbols = /[§¶†‡]/g.test(text);
      
      if (hasSpecialCharacters || hasUnusualSymbols) {
        if (clues.length < 3) {
          clues.push({
            type: 'unusual-text',
            content: `Texto inusual detectado: "${text.substring(0, 50)}..."`,
            source: window.location.href,
            timestamp: Date.now()
          });
        }
      }
    });
    
    return clues;
  }
  
  generateVisualAnalystClues() {
    const clues = [];
    
    // Buscar imágenes que puedan contener pistas ocultas
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      // Evitar imágenes muy pequeñas o sin src
      if (!img.src || img.width < 100 || img.height < 100) return;
      
      // En una implementación real, aquí habría análisis de imágenes
      // Por ahora, simulamos "detectar" características interesantes
      
      // Seleccionar aleatoriamente algunas imágenes como "interesantes"
      // Esto es solo para demostración
      if (clues.length < 2 && Math.random() > 0.7) {
        clues.push({
          type: 'interesting-image',
          content: `Imagen con posibles pistas ocultas detectada`,
          imageUrl: img.src,
          source: window.location.href,
          timestamp: Date.now()
        });
      }
    });
    
    // Buscar patrones de colores o elementos visuales llamativos
    const colorfulElements = document.querySelectorAll('[style*="color"]');
    
    if (colorfulElements.length > 10 && clues.length < 3) {
      clues.push({
        type: 'color-pattern',
        content: `Patrón de colores detectado - podría contener un mensaje oculto`,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  generateHistorianClues() {
    const clues = [];
    
    // Buscar referencias a fechas históricas
    const pageText = document.body.innerText;
    const dateRegex = /\b(1[0-9]{3}|20[0-1][0-9])\b/g; // Años entre 1000-2019
    const matches = pageText.match(dateRegex);
    
    if (matches && matches.length > 3) { // Si hay varias referencias a años
      clues.push({
        type: 'historical-dates',
        content: `Varias referencias históricas detectadas: ${matches.slice(0, 5).join(', ')}...`,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // Buscar términos relacionados con historia o cultura
    const historicalTerms = ['ancient', 'medieval', 'discovery', 'civilization', 'dynasty', 'empire', 'revolution'];
    let foundTerms = [];
    
    historicalTerms.forEach(term => {
      if (pageText.toLowerCase().includes(term)) {
        foundTerms.push(term);
      }
    });
    
    if (foundTerms.length > 2 && clues.length < 3) {
      clues.push({
        type: 'historical-terms',
        content: `Términos históricos relevantes: ${foundTerms.join(', ')}`,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  generateNavigatorClues() {
    const clues = [];
    
    // Analizar la estructura de navegación de la página
    const links = document.querySelectorAll('a');
    
    // Buscar patrones inusuales en URLs
    const unusualUrls = new Set();
    links.forEach(link => {
      const href = link.href;
      
      // Buscar URLs con patrones interesantes
      if (href && href.includes('?code=')) {
        unusualUrls.add(href);
      }
      
      // Buscar URLs con hash fragments poco comunes
      if (href && href.includes('#') && href.split('#')[1].length > 20) {
        unusualUrls.add(href);
      }
    });
    
    if (unusualUrls.size > 0 && clues.length < 2) {
      const urlsArray = Array.from(unusualUrls);
      clues.push({
        type: 'unusual-urls',
        content: `URLs con patrones inusuales detectadas: ${urlsArray.length} enlaces`,
        examples: urlsArray.slice(0, 3),
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // Determinar si la página tiene una estructura de navegación compleja
    const navElements = document.querySelectorAll('nav, [role="navigation"]');
    if (navElements.length > 2 && clues.length < 3) {
      clues.push({
        type: 'complex-navigation',
        content: `Estructura de navegación compleja detectada - podría contener rutas ocultas`,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  // Comprobar si hay que añadir elementos visuales a la página
  checkForVisualElements() {
    // En una implementación completa, aquí se comprobaría si la página
    // es parte de una misión activa y se añadirían elementos visuales
    
    // Por ahora, simplemente marcamos la página como "visitada"
    chrome.storage.local.set({
      [`visited_${window.location.hostname}`]: Date.now()
    }).catch(err => console.error('Error al marcar página como visitada:', err));
  }
  
  // Añadir un marcador de pista en una posición específica
  addClueMarker(x, y, clueInfo) {
    const marker = document.createElement('div');
    marker.className = 'dth-clue-marker';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    
    // Guardar información de la pista en el marcador
    marker.dataset.clueType = clueInfo.type;
    marker.dataset.clueContent = clueInfo.content;
    
    // Añadir evento de click para mostrar información
    marker.addEventListener('click', this.showClueTooltip.bind(this, marker, clueInfo));
    
    document.body.appendChild(marker);
  }
  
  // Mostrar tooltip con información de la pista
  showClueTooltip(marker, clueInfo) {
    // Eliminar cualquier tooltip existente
    const existingTooltip = document.querySelector('.dth-clue-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // Crear nuevo tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'dth-clue-tooltip';
    
    // Contenido del tooltip
    tooltip.innerHTML = `
      <div class="dth-tooltip-header">Pista descubierta</div>
      <div class="dth-tooltip-content">${clueInfo.content}</div>
      <div class="dth-tooltip-footer">Rol requerido: ${this.formatRoleName(this.currentRole)}</div>
    `;
    
    // Posicionar el tooltip cerca del marcador
    const markerRect = marker.getBoundingClientRect();
    tooltip.style.left = `${markerRect.right + 10}px`;
    tooltip.style.top = `${markerRect.top}px`;
    
    // Añadir al documento
    document.body.appendChild(tooltip);
    
    // Mostrar el tooltip
    tooltip.style.display = 'block';
    
    // Añadir evento para cerrar tooltip al hacer clic fuera
    document.addEventListener('click', function closeTooltip(e) {
      if (e.target !== marker && !tooltip.contains(e.target)) {
        tooltip.remove();
        document.removeEventListener('click', closeTooltip);
      }
    });
    
    // Enviar mensaje al background script
    chrome.runtime.sendMessage({
      action: 'clueDiscovered',
      clue: clueInfo
    });
  }
  
  // Formato para los nombres de roles
  formatRoleName(role) {
    const roleNames = {
      'decoder': 'Decodificador',
      'translator': 'Traductor',
      'visual-analyst': 'Analista Visual',
      'historian': 'Historiador',
      'navigator': 'Navegador'
    };
    
    return roleNames[role] || role;
  }
  
  // Resaltar elemento con una pista
  highlightElement(element, clueInfo) {
    // Añadir clase de resaltado
    element.classList.add('dth-highlight');
    
    // Guardar información de la pista en el elemento
    element.dataset.clueType = clueInfo.type;
    element.dataset.clueContent = clueInfo.content;
    
    // Añadir evento de click para mostrar información
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showClueTooltip(element, clueInfo);
    });
  }
}

// Inicializar la clase cuando se carga la página
const scanner = new TreasureHunterPageScanner();

// Crear algunos estilos personalizados para los elementos visuales
function addCustomStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .dth-clue-marker {
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: rgba(60, 110, 113, 0.7);
      box-shadow: 0 0 10px rgba(60, 110, 113, 0.5);
      cursor: pointer;
      z-index: 9999;
      transition: transform 0.3s, background-color 0.3s;
    }
    
    .dth-clue-marker:hover {
      transform: scale(1.2);
      background-color: rgba(60, 110, 113, 0.9);
    }
    
    .dth-clue-tooltip {
      position: absolute;
      background-color: #fff;
      border: 2px solid #3c6e71;
      border-radius: 6px;
      padding: 10px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 250px;
      z-index: 10000;
      display: none;
    }
    
    .dth-highlight {
      background-color: rgba(217, 194, 173, 0.3);
      outline: 2px dashed rgba(60, 110, 113, 0.5);
      cursor: pointer;
    }
  `;
  document.head.appendChild(styleElement);
}

// Añadir estilos personalizados
addCustomStyles();