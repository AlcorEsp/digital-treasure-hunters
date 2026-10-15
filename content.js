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

      // Modo Alpha vs Beta: Esconder / Capturar un elemento de la página
      if (message.action === 'startCaptureTarget') {
        this.startCaptureTargetMode(message.team || 'team-alpha');
        sendResponse({ success: true });
        return true;
      }

      // Modo Alpha vs Beta: Verificar / Reclamar el objetivo del equipo rival
      if (message.action === 'startVerifyTarget') {
        this.startVerifyTargetMode(message.challenge);
        sendResponse({ success: true });
        return true;
      }
    });
  }

  // === MODO COMPETITIVO ALPHA VS BETA: ESCONDER Y VERIFICAR OBJETIVOS ===

  cleanupInteractiveMode() {
    if (this.activeBanner) {
      this.activeBanner.remove();
      this.activeBanner = null;
    }
    if (this.hoveredElement) {
      this.hoveredElement.classList.remove('dth-target-CleanHover', 'dth-verify-CleanHover');
      this.hoveredElement = null;
    }
    if (this.boundMouseOver) {
      document.removeEventListener('mouseover', this.boundMouseOver, true);
      document.removeEventListener('click', this.boundClick, true);
      this.boundMouseOver = null;
      this.boundClick = null;
    }
  }

  buildElementSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${el.id}`;
    let path = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(c => !c.startsWith('dth-')).slice(0, 2);
      if (classes.length > 0) path += '.' + classes.join('.');
    }
    return path;
  }

  startCaptureTargetMode(teamId) {
    this.cleanupInteractiveMode();

    const teamName = teamId === 'team-beta' ? 'Equipo Beta' : 'Equipo Alpha';
    const banner = document.createElement('div');
    banner.className = 'dth-mode-banner';
    banner.innerHTML = `
      <span>🎯 <strong>${teamName}:</strong> Haz clic en cualquier imagen, título o elemento de la página para esconderlo como reto</span>
      <button type="button" id="dth-cancel-mode">Cancelar</button>
    `;
    document.body.appendChild(banner);
    this.activeBanner = banner;

    banner.querySelector('#dth-cancel-mode').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cleanupInteractiveMode();
    });

    this.boundMouseOver = (e) => {
      if (banner.contains(e.target)) return;
      if (this.hoveredElement && this.hoveredElement !== e.target) {
        this.hoveredElement.classList.remove('dth-target-CleanHover');
      }
      this.hoveredElement = e.target;
      this.hoveredElement.classList.add('dth-target-CleanHover');
    };

    this.boundClick = (e) => {
      if (banner.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();

      const targetEl = e.target;
      const rect = targetEl.getBoundingClientRect();

      // Limpiar bordes y banner antes de tomar la captura de pantalla
      this.cleanupInteractiveMode();

      // Extraer contexto rico de la página para que la IA genere pistas para los 5 roles
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.innerText.trim())
        .filter(t => t.length > 2)
        .slice(0, 5);

      const pageText = document.body.innerText || '';
      const years = [...new Set(pageText.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g) || [])].slice(0, 5);
      const elementText = (targetEl.innerText || targetEl.alt || targetEl.title || '').trim().substring(0, 220);

      const targetData = {
        teamId: teamId,
        url: window.location.origin + window.location.pathname,
        fullUrl: window.location.href,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        pageTitle: document.title || window.location.hostname,
        selector: this.buildElementSelector(targetEl),
        elementTag: targetEl.tagName.toLowerCase(),
        elementText: elementText || document.title,
        elementSrc: targetEl.src || '',
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(Math.max(rect.width, 40)),
          height: Math.round(Math.max(rect.height, 40)),
          devicePixelRatio: window.devicePixelRatio || 1
        },
        context: {
          headings,
          years,
          lang: document.documentElement.lang || 'es',
          linksCount: document.querySelectorAll('a[href]').length
        }
      };

      // Esperar un frame para que el DOM se pinte limpio sin el borde rojo antes de la captura
      requestAnimationFrame(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'createRivalChallenge',
            targetData
          }, (res) => {
            if (res && res.success) {
              alert('🎯 ¡Objetivo capturado y escondido! La IA ha generado las 5 pistas por rol para el equipo rival.');
            } else {
              alert('Error al guardar el reto: ' + ((res && res.error) || 'Inténtalo de nuevo'));
            }
          });
        }, 120);
      });
    };

    document.addEventListener('mouseover', this.boundMouseOver, true);
    document.addEventListener('click', this.boundClick, true);
  }

  startVerifyTargetMode(challenge) {
    if (!challenge) return;
    this.cleanupInteractiveMode();

    const banner = document.createElement('div');
    banner.className = 'dth-mode-banner';
    banner.innerHTML = `
      <span>🕵️ <strong>MODO CAZA:</strong> Haz clic sobre el elemento exacto que escondió el ${challenge.teamId === 'team-alpha' ? 'Equipo Alpha' : 'Equipo Beta'}</span>
      <button type="button" id="dth-cancel-mode">Cancelar</button>
    `;
    document.body.appendChild(banner);
    this.activeBanner = banner;

    banner.querySelector('#dth-cancel-mode').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cleanupInteractiveMode();
    });

    this.boundMouseOver = (e) => {
      if (banner.contains(e.target)) return;
      if (this.hoveredElement && this.hoveredElement !== e.target) {
        this.hoveredElement.classList.remove('dth-verify-CleanHover');
      }
      this.hoveredElement = e.target;
      this.hoveredElement.classList.add('dth-verify-CleanHover');
    };

    this.boundClick = (e) => {
      if (banner.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();

      const clickedEl = e.target;
      const clickedSelector = this.buildElementSelector(clickedEl);
      const clickedText = (clickedEl.innerText || clickedEl.alt || clickedEl.title || '').trim().substring(0, 220);

      this.cleanupInteractiveMode();

      // Comprobar si estamos en la misma URL/página
      const currentCleanUrl = (window.location.origin + window.location.pathname).replace(/\/$/, '').toLowerCase();
      const targetCleanUrl = (challenge.url || '').replace(/\/$/, '').toLowerCase();
      const samePage = currentCleanUrl === targetCleanUrl || window.location.hostname.toLowerCase() === (challenge.hostname || '').toLowerCase() && window.location.pathname === challenge.pathname;

      if (!samePage) {
        alert('❌ Esta no es la página web correcta. Revisa las pistas del Navegador, Decodificador e Historiador para encontrar la URL.');
        return;
      }

      // Comprobar coincidencia del elemento (mismo selector, o mismo texto/imagen, o elemento padre/hijo directo)
      const selectorMatch = clickedSelector === challenge.selector;
      const textMatch = challenge.elementText && clickedText && (
        clickedText.includes(challenge.elementText.substring(0, 25)) ||
        challenge.elementText.includes(clickedText.substring(0, 25))
      );
      const srcMatch = challenge.elementSrc && clickedEl.src && clickedEl.src === challenge.elementSrc;
      const tagMatch = clickedEl.tagName.toLowerCase() === challenge.elementTag;

      if (selectorMatch || srcMatch || (textMatch && tagMatch) || textMatch) {
        chrome.runtime.sendMessage({
          action: 'solveRivalChallenge',
          challengeId: challenge.id
        }, () => {
          alert('🏆 ¡ENCONTRADO! Has descubierto el objetivo oculto del equipo rival. ¡+500 XP y +1 Punto para tu equipo!');
        });
      } else {
        alert('⚠️ ¡Estás en la página web correcta! Pero ese no es el elemento exacto que capturaron. Pide ayuda al Analista Visual y vuelve a intentarlo.');
      }
    };

    document.addEventListener('mouseover', this.boundMouseOver, true);
    document.addEventListener('click', this.boundClick, true);
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
    const clues = this.clueGenerators[this.currentRole]();
    this.renderPageClueBadge(clues);
    return clues;
  }

  // Mostrar un indicador flotante en la página cuando se detectan pistas
  renderPageClueBadge(clues) {
    const existingIndicator = document.querySelector('.dth-clue-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (!clues || clues.length === 0) return;

    const indicator = document.createElement('div');
    indicator.className = 'dth-clue-indicator';
    indicator.title = `${clues.length} pista(s) detectada(s) como ${this.formatRoleName(this.currentRole)}. Haz clic para ver detalles.`;
    
    indicator.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showClueTooltip(indicator, clues[0]);
    });

    document.body.appendChild(indicator);
  }
  
  // Métodos para generar pistas según cada rol
  generateDecoderClues() {
    const clues = [];
    const pageText = document.body.innerText;
    const htmlContent = document.documentElement.outerHTML;
    
    // 1. Detección avanzada de Base64 con validación
    const base64Regex = /[A-Za-z0-9+/]{20,}={0,2}/g;
    const base64Matches = pageText.match(base64Regex);
    
    if (base64Matches) {
      base64Matches.forEach(match => {
        if (clues.length < 2 && this.isLikelyBase64(match)) {
          try {
            const decoded = atob(match);
            if (this.isReadableText(decoded)) {
              clues.push({
                type: 'base64-text',
                content: `Texto Base64 decodificado: "${decoded.substring(0, 40)}..."`,
                encoded: match.substring(0, 30) + '...',
                source: window.location.href,
                timestamp: Date.now()
              });
            }
          } catch (e) {
            // No es Base64 válido, continuar
          }
        }
      });
    }
    
    // 2. Detección de códigos hexadecimales
    const hexRegex = /\b[0-9a-fA-F]{8,}\b/g;
    const hexMatches = pageText.match(hexRegex);
    
    if (hexMatches && hexMatches.length > 2) {
      const validHex = hexMatches.filter(hex => hex.length >= 8 && hex.length <= 64);
      if (validHex.length > 0 && clues.length < 3) {
        clues.push({
          type: 'hex-codes',
          content: `Códigos hexadecimales detectados: ${validHex.length} códigos`,
          examples: validHex.slice(0, 3),
          source: window.location.href,
          timestamp: Date.now()
        });
      }
    }
    
    // 3. Detección de cifrado César (análisis de frecuencia)
    const suspiciousTexts = this.findSuspiciousTexts(pageText);
    if (suspiciousTexts.length > 0 && clues.length < 4) {
      clues.push({
        type: 'caesar-cipher',
        content: `Posible cifrado César detectado: "${suspiciousTexts[0].substring(0, 30)}..."`,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 4. Comentarios HTML ocultos con información relevante
    const commentRegex = /<!--(.+?)-->/gs;
    const commentMatches = htmlContent.matchAll(commentRegex);
    
    for (const match of commentMatches) {
      const comment = match[1].trim();
      if (clues.length < 5 && this.isInterestingComment(comment)) {
        clues.push({
          type: 'hidden-comment',
          content: `Comentario oculto: "${comment.substring(0, 50)}..."`,
          source: window.location.href,
          timestamp: Date.now()
        });
      }
    }
    
    // 5. Patrones numéricos ocultos en texto
    const numberPatterns = this.findNumberPatterns(pageText);
    if (numberPatterns.length > 0 && clues.length < 6) {
      clues.push({
        type: 'number-patterns',
        content: `Patrones numéricos detectados: ${numberPatterns.join(', ')}`,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  // Métodos auxiliares para el Decodificador
  isLikelyBase64(str) {
    return str.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(str);
  }
  
  isReadableText(str) {
    // Verificar si el texto decodificado es legible
    const readableChars = str.match(/[a-zA-Z0-9\s]/g);
    return readableChars && readableChars.length > str.length * 0.6;
  }
  
  findSuspiciousTexts(text) {
    const words = text.match(/\b[A-Za-z]{5,}\b/g) || [];
    const suspicious = [];
    
    words.forEach(word => {
      // Buscar palabras con distribución de letras inusual
      const letterFreq = {};
      for (let char of word.toLowerCase()) {
        letterFreq[char] = (letterFreq[char] || 0) + 1;
      }
      
      // Si todas las letras son diferentes (posible cifrado)
      if (Object.keys(letterFreq).length === word.length && word.length > 6) {
        suspicious.push(word);
      }
    });
    
    return suspicious.slice(0, 3);
  }
  
  isInterestingComment(comment) {
    // Filtrar comentarios que parecen tener información relevante
    const keywords = ['todo', 'hack', 'fix', 'bug', 'secret', 'hidden', 'key', 'password', 'debug'];
    const lowerComment = comment.toLowerCase();
    
    return keywords.some(keyword => lowerComment.includes(keyword)) ||
           comment.length > 20 ||
           /\b[0-9a-fA-F]{8,}\b/.test(comment);
  }
  
  findNumberPatterns(text) {
    const patterns = [];
    
    // Buscar secuencias numéricas
    const sequences = text.match(/\b\d{3,}\b/g) || [];
    
    sequences.forEach(seq => {
      if (seq.length >= 4) {
        // Verificar si es una secuencia aritmética
        const digits = seq.split('').map(Number);
        let isArithmetic = true;
        const diff = digits[1] - digits[0];
        
        for (let i = 2; i < digits.length; i++) {
          if (digits[i] - digits[i-1] !== diff) {
            isArithmetic = false;
            break;
          }
        }
        
        if (isArithmetic && patterns.length < 3) {
          patterns.push(`Secuencia: ${seq}`);
        }
      }
    });
    
    return patterns;
  }
  
  generateTranslatorClues() {
    const clues = [];
    const allElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
    const processedTexts = new Set();
    
    allElements.forEach(el => {
      const text = el.innerText.trim();
      
      if (text.length < 15 || processedTexts.has(text)) return;
      processedTexts.add(text);
      
      // 1. Detección de scripts no latinos (más específico)
      const scriptInfo = this.analyzeTextScript(text);
      if (scriptInfo.nonLatin && clues.length < 2) {
        clues.push({
          type: 'non-latin-script',
          content: `Texto en ${scriptInfo.scriptName}: "${text.substring(0, 40)}..."`,
          script: scriptInfo.scriptName,
          source: window.location.href,
          timestamp: Date.now()
        });
      }
      
      // 2. Detección de idiomas específicos por patrones
      const languageInfo = this.detectLanguagePatterns(text);
      if (languageInfo.language && languageInfo.confidence > 0.7 && clues.length < 3) {
        clues.push({
          type: 'foreign-language',
          content: `Texto en ${languageInfo.language} detectado: "${text.substring(0, 40)}..."`,
          language: languageInfo.language,
          confidence: languageInfo.confidence,
          source: window.location.href,
          timestamp: Date.now()
        });
      }
      
      // 3. Detección de códigos de idioma (ISO)
      const languageCodes = this.findLanguageCodes(text);
      if (languageCodes.length > 0 && clues.length < 4) {
        clues.push({
          type: 'language-codes',
          content: `Códigos de idioma detectados: ${languageCodes.join(', ')}`,
          codes: languageCodes,
          source: window.location.href,
          timestamp: Date.now()
        });
      }
    });
    
    // 4. Buscar atributos lang en HTML
    const langElements = document.querySelectorAll('[lang]');
    if (langElements.length > 0) {
      const uniqueLangs = [...new Set(Array.from(langElements).map(el => el.getAttribute('lang')))];
      if (uniqueLangs.length > 1 && clues.length < 5) {
        clues.push({
          type: 'html-lang-attributes',
          content: `Múltiples idiomas en HTML: ${uniqueLangs.join(', ')}`,
          languages: uniqueLangs,
          source: window.location.href,
          timestamp: Date.now()
        });
      }
    }
    
    // 5. Detección de texto con diacríticos poco comunes
    const diacriticText = this.findUnusualDiacritics(document.body.innerText);
    if (diacriticText.length > 0 && clues.length < 6) {
      clues.push({
        type: 'unusual-diacritics',
        content: `Texto con diacríticos poco comunes: "${diacriticText[0].substring(0, 30)}..."`,
        examples: diacriticText,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  // Métodos auxiliares para el Traductor
  analyzeTextScript(text) {
    const scripts = {
      cyrillic: /[\u0400-\u04FF]/,
      greek: /[\u0370-\u03FF]/,
      arabic: /[\u0600-\u06FF]/,
      hebrew: /[\u0590-\u05FF]/,
      cjk: /[\u4E00-\u9FFF]/,
      hiragana: /[\u3040-\u309F]/,
      katakana: /[\u30A0-\u30FF]/,
      thai: /[\u0E00-\u0E7F]/,
      korean: /[\uAC00-\uD7AF]/
    };
    
    for (const [scriptName, regex] of Object.entries(scripts)) {
      if (regex.test(text)) {
        return { nonLatin: true, scriptName: scriptName.charAt(0).toUpperCase() + scriptName.slice(1) };
      }
    }
    
    return { nonLatin: false };
  }
  
  detectLanguagePatterns(text) {
    const patterns = {
      'Alemán': {
        common: ['der', 'die', 'das', 'und', 'ist', 'von', 'mit', 'den', 'zu', 'auf'],
        endings: ['ung', 'keit', 'heit', 'schaft', 'lich'],
        score: 0
      },
      'Francés': {
        common: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour'],
        endings: ['tion', 'sion', 'ment', 'ique', 'eur'],
        score: 0
      },
      'Italiano': {
        common: ['il', 'di', 'che', 'la', 'è', 'un', 'per', 'non', 'con', 'una'],
        endings: ['zione', 'mente', 'ismo', 'ista', 'ezza'],
        score: 0
      },
      'Portugués': {
        common: ['o', 'de', 'a', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma'],
        endings: ['ção', 'mente', 'ismo', 'ista', 'eza'],
        score: 0
      }
    };
    
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    Object.keys(patterns).forEach(lang => {
      const pattern = patterns[lang];
      
      // Verificar palabras comunes
      words.forEach(word => {
        if (pattern.common.includes(word)) {
          pattern.score += 2;
        }
        
        // Verificar terminaciones
        pattern.endings.forEach(ending => {
          if (word.endsWith(ending)) {
            pattern.score += 1;
          }
        });
      });
    });
    
    const bestMatch = Object.entries(patterns).reduce((best, [lang, pattern]) => {
      const confidence = Math.min(pattern.score / words.length, 1);
      return confidence > best.confidence ? { language: lang, confidence } : best;
    }, { language: null, confidence: 0 });
    
    return bestMatch;
  }
  
  findLanguageCodes(text) {
    const isoCodes = /\b[a-z]{2}[-_][A-Z]{2}\b/g;
    const matches = text.match(isoCodes) || [];
    return [...new Set(matches)].slice(0, 5);
  }
  
  findUnusualDiacritics(text) {
    const diacriticRegex = /\b\w*[àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ]\w*\b/gi;
    const matches = text.match(diacriticRegex) || [];
    return [...new Set(matches)].slice(0, 3);
  }
  
  generateVisualAnalystClues() {
    const clues = [];
    
    // 1. Análisis avanzado de imágenes
    const images = document.querySelectorAll('img');
    const suspiciousImages = [];
    
    images.forEach(img => {
      if (!img.src || img.width < 50 || img.height < 50) return;
      
      // Análisis de metadatos de imagen
      const imageInfo = this.analyzeImageMetadata(img);
      if (imageInfo.suspicious) {
        suspiciousImages.push({
          url: img.src,
          alt: img.alt,
          dimensions: `${img.width}x${img.height}`,
          reason: imageInfo.reason
        });
      }
    });
    
    if (suspiciousImages.length > 0 && clues.length < 2) {
      clues.push({
        type: 'suspicious-images',
        content: `${suspiciousImages.length} imágenes con características inusuales detectadas`,
        images: suspiciousImages.slice(0, 3),
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 2. Análisis de patrones CSS ocultos
    const hiddenElements = this.findHiddenElements();
    if (hiddenElements.length > 0 && clues.length < 3) {
      clues.push({
        type: 'hidden-elements',
        content: `Elementos visualmente ocultos detectados: ${hiddenElements.length} elementos`,
        elements: hiddenElements,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 3. Análisis de patrones de color sofisticados
    const colorAnalysis = this.analyzeColorPatterns();
    if (colorAnalysis.hasPattern && clues.length < 4) {
      clues.push({
        type: 'color-cipher',
        content: `Posible cifrado por colores detectado: ${colorAnalysis.colorCount} colores únicos`,
        pattern: colorAnalysis.pattern,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 4. Detección de elementos con transformaciones CSS sospechosas
    const transformedElements = this.findTransformedElements();
    if (transformedElements.length > 0 && clues.length < 5) {
      clues.push({
        type: 'css-transformations',
        content: `Elementos con transformaciones CSS inusuales: ${transformedElements.length} elementos`,
        transformations: transformedElements,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 5. Análisis de sprites y fondos con patrones
    const backgroundPatterns = this.analyzeBackgroundPatterns();
    if (backgroundPatterns.length > 0 && clues.length < 6) {
      clues.push({
        type: 'background-patterns',
        content: `Patrones en fondos detectados: ${backgroundPatterns.length} elementos`,
        patterns: backgroundPatterns,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  // Métodos auxiliares para el Analista Visual
  analyzeImageMetadata(img) {
    const suspicious = {
      suspicious: false,
      reason: ''
    };
    
    // Verificar dimensiones inusuales
    if (img.width === img.height && img.width > 200) {
      suspicious.suspicious = true;
      suspicious.reason = 'Dimensiones cuadradas perfectas';
    }
    
    // Verificar nombres de archivo sospechosos
    const filename = img.src.split('/').pop().toLowerCase();
    const suspiciousNames = ['hidden', 'secret', 'code', 'cipher', 'puzzle', 'clue'];
    
    if (suspiciousNames.some(name => filename.includes(name))) {
      suspicious.suspicious = true;
      suspicious.reason = 'Nombre de archivo sugerente';
    }
    
    // Verificar alt text con patrones
    if (img.alt && /\b[0-9a-fA-F]{8,}\b/.test(img.alt)) {
      suspicious.suspicious = true;
      suspicious.reason = 'Alt text con códigos hexadecimales';
    }
    
    return suspicious;
  }
  
  findHiddenElements() {
    const hiddenElements = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      
      // Elementos con opacity muy baja pero no 0
      if (parseFloat(style.opacity) < 0.1 && parseFloat(style.opacity) > 0) {
        hiddenElements.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent.substring(0, 50),
          reason: 'Opacity muy baja'
        });
      }
      
      // Elementos con colores muy similares al fondo
      if (this.isNearlyInvisible(el, style)) {
        hiddenElements.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent.substring(0, 50),
          reason: 'Color similar al fondo'
        });
      }
    });
    
    return hiddenElements.slice(0, 5);
  }
  
  isNearlyInvisible(element, style) {
    const color = style.color;
    const backgroundColor = style.backgroundColor;
    
    // Verificar si el texto es casi del mismo color que el fondo
    if (color && backgroundColor) {
      const textColor = this.parseColor(color);
      const bgColor = this.parseColor(backgroundColor);
      
      if (textColor && bgColor) {
        const diff = Math.abs(textColor.r - bgColor.r) + 
                    Math.abs(textColor.g - bgColor.g) + 
                    Math.abs(textColor.b - bgColor.b);
        
        return diff < 30; // Muy similar
      }
    }
    
    return false;
  }
  
  parseColor(color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    const computedColor = ctx.fillStyle;
    
    const match = computedColor.match(/^#([0-9a-f]{6})$/i);
    if (match) {
      const hex = match[1];
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16)
      };
    }
    
    return null;
  }
  
  analyzeColorPatterns() {
    const coloredElements = document.querySelectorAll('[style*="color"]');
    const colors = new Set();
    
    coloredElements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.color) colors.add(style.color);
      if (style.backgroundColor) colors.add(style.backgroundColor);
    });
    
    return {
      hasPattern: colors.size > 5 && colors.size < 20,
      colorCount: colors.size,
      pattern: Array.from(colors).slice(0, 5)
    };
  }
  
  findTransformedElements() {
    const transformed = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      
      if (style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
        transformed.push({
          tag: el.tagName.toLowerCase(),
          transform: style.transform.substring(0, 50),
          text: el.textContent.substring(0, 30)
        });
      }
    });
    
    return transformed.slice(0, 3);
  }
  
  analyzeBackgroundPatterns() {
    const patterns = [];
    const elementsWithBg = document.querySelectorAll('*');
    
    elementsWithBg.forEach(el => {
      const style = window.getComputedStyle(el);
      
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        const bgImage = style.backgroundImage;
        
        // Buscar patrones repetitivos
        if (bgImage.includes('repeat') || style.backgroundRepeat !== 'no-repeat') {
          patterns.push({
            element: el.tagName.toLowerCase(),
            pattern: bgImage.substring(0, 50),
            repeat: style.backgroundRepeat
          });
        }
      }
    });
    
    return patterns.slice(0, 3);
  }
  
  generateHistorianClues() {
    const clues = [];
    const pageText = document.body.innerText;
    
    // 1. Análisis avanzado de fechas históricas
    const historicalDates = this.analyzeHistoricalDates(pageText);
    if (historicalDates.length > 0 && clues.length < 2) {
      clues.push({
        type: 'historical-dates',
        content: `Fechas históricas significativas: ${historicalDates.map(d => d.date).join(', ')}`,
        dates: historicalDates,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 2. Detección de eventos históricos específicos
    const historicalEvents = this.detectHistoricalEvents(pageText);
    if (historicalEvents.length > 0 && clues.length < 3) {
      clues.push({
        type: 'historical-events',
        content: `Eventos históricos detectados: ${historicalEvents.length} referencias`,
        events: historicalEvents,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 3. Análisis de figuras históricas
    const historicalFigures = this.detectHistoricalFigures(pageText);
    if (historicalFigures.length > 0 && clues.length < 4) {
      clues.push({
        type: 'historical-figures',
        content: `Figuras históricas mencionadas: ${historicalFigures.join(', ')}`,
        figures: historicalFigures,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 4. Detección de civilizaciones y culturas
    const civilizations = this.detectCivilizations(pageText);
    if (civilizations.length > 0 && clues.length < 5) {
      clues.push({
        type: 'civilizations',
        content: `Civilizaciones o culturas detectadas: ${civilizations.join(', ')}`,
        civilizations: civilizations,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 5. Análisis de períodos históricos
    const periods = this.detectHistoricalPeriods(pageText);
    if (periods.length > 0 && clues.length < 6) {
      clues.push({
        type: 'historical-periods',
        content: `Períodos históricos identificados: ${periods.join(', ')}`,
        periods: periods,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  // Métodos auxiliares para el Historiador
  analyzeHistoricalDates(text) {
    const dates = [];
    
    // Buscar años con contexto histórico
    const yearRegex = /\b(1[0-9]{3}|20[0-1][0-9])\b/g;
    const matches = text.match(yearRegex);
    
    if (matches) {
      const significantYears = matches.filter(year => {
        const y = parseInt(year);
        return (y >= 1000 && y <= 2023) && this.isHistoricallySignificant(y);
      });
      
      // Agrupar años por período
      const periods = {
        'Edad Media': significantYears.filter(y => parseInt(y) >= 1000 && parseInt(y) <= 1500),
        'Renacimiento': significantYears.filter(y => parseInt(y) >= 1400 && parseInt(y) <= 1600),
        'Era Moderna': significantYears.filter(y => parseInt(y) >= 1700 && parseInt(y) <= 1900),
        'Siglo XX': significantYears.filter(y => parseInt(y) >= 1900 && parseInt(y) <= 2000),
        'Siglo XXI': significantYears.filter(y => parseInt(y) >= 2000)
      };
      
      Object.entries(periods).forEach(([period, years]) => {
        if (years.length > 0) {
          dates.push({
            period: period,
            date: years.join(', '),
            count: years.length
          });
        }
      });
    }
    
    return dates.slice(0, 3);
  }
  
  isHistoricallySignificant(year) {
    // Años con eventos históricos conocidos
    const significantYears = [
      1066, 1215, 1492, 1776, 1789, 1848, 1914, 1918, 1929, 1939, 1945, 1969, 1989, 2001
    ];
    
    return significantYears.includes(year) || 
           year % 100 === 0 || // Años de cambio de siglo
           year % 50 === 0;    // Años de medio siglo
  }
  
  detectHistoricalEvents(text) {
    const events = [];
    const eventPatterns = {
      'Revolución Francesa': /revolución\s+francesa|revolución\s+de\s+1789/gi,
      'Segunda Guerra Mundial': /segunda\s+guerra\s+mundial|wwii|world\s+war\s+ii/gi,
      'Revolución Industrial': /revolución\s+industrial/gi,
      'Descubrimiento de América': /descubrimiento\s+de\s+américa|1492|colón/gi,
      'Caída del Muro de Berlín': /muro\s+de\s+berlín|1989/gi,
      'Revolución Rusa': /revolución\s+rusa|1917/gi,
      'Renacimiento': /renacimiento|renaissance/gi,
      'Independencia Americana': /independencia\s+americana|1776/gi
    };
    
    Object.entries(eventPatterns).forEach(([event, pattern]) => {
      if (pattern.test(text)) {
        events.push(event);
      }
    });
    
    return events.slice(0, 4);
  }
  
  detectHistoricalFigures(text) {
    const figures = [];
    const figurePatterns = {
      'Napoleon': /napoleón|napoleon/gi,
      'Leonardo da Vinci': /leonardo\s+da\s+vinci|leonardo/gi,
      'Shakespeare': /shakespeare|william\s+shakespeare/gi,
      'Einstein': /einstein|albert\s+einstein/gi,
      'Churchill': /churchill|winston\s+churchill/gi,
      'Cleopatra': /cleopatra/gi,
      'Cesar': /césar|julius\s+caesar|julio\s+césar/gi,
      'Alejandro Magno': /alejandro\s+magno|alexander\s+the\s+great/gi,
      'Cristóbal Colón': /cristóbal\s+colón|christopher\s+columbus/gi,
      'Galileo': /galileo/gi
    };
    
    Object.entries(figurePatterns).forEach(([figure, pattern]) => {
      if (pattern.test(text)) {
        figures.push(figure);
      }
    });
    
    return figures.slice(0, 5);
  }
  
  detectCivilizations(text) {
    const civilizations = [];
    const civilizationPatterns = {
      'Imperio Romano': /imperio\s+romano|roman\s+empire/gi,
      'Antiguo Egipto': /antiguo\s+egipto|ancient\s+egypt/gi,
      'Grecia Antigua': /grecia\s+antigua|ancient\s+greece/gi,
      'Imperio Bizantino': /imperio\s+bizantino|byzantine\s+empire/gi,
      'Imperio Otomano': /imperio\s+otomano|ottoman\s+empire/gi,
      'Civilización Maya': /civilización\s+maya|maya\s+civilization/gi,
      'Imperio Azteca': /imperio\s+azteca|aztec\s+empire/gi,
      'Imperio Inca': /imperio\s+inca|inca\s+empire/gi,
      'Dinastía Ming': /dinastía\s+ming|ming\s+dynasty/gi,
      'Imperio Persa': /imperio\s+persa|persian\s+empire/gi
    };
    
    Object.entries(civilizationPatterns).forEach(([civilization, pattern]) => {
      if (pattern.test(text)) {
        civilizations.push(civilization);
      }
    });
    
    return civilizations.slice(0, 4);
  }
  
  detectHistoricalPeriods(text) {
    const periods = [];
    const periodPatterns = {
      'Edad Media': /edad\s+media|medieval|middle\s+ages/gi,
      'Renacimiento': /renacimiento|renaissance/gi,
      'Barroco': /barroco|baroque/gi,
      'Ilustración': /ilustración|enlightenment/gi,
      'Romanticismo': /romanticismo|romanticism/gi,
      'Neoclásico': /neoclásico|neoclassicism/gi,
      'Modernismo': /modernismo|modernism/gi,
      'Prehistoria': /prehistoria|prehistoric/gi,
      'Antigüedad': /antigüedad|antiquity/gi,
      'Era Victoriana': /era\s+victoriana|victorian\s+era/gi
    };
    
    Object.entries(periodPatterns).forEach(([period, pattern]) => {
      if (pattern.test(text)) {
        periods.push(period);
      }
    });
    
    return periods.slice(0, 3);
  }
  
  generateNavigatorClues() {
    const clues = [];
    
    // 1. Análisis avanzado de estructura de navegación
    const navigationAnalysis = this.analyzeNavigationStructure();
    if (navigationAnalysis.isComplex && clues.length < 2) {
      clues.push({
        type: 'complex-navigation',
        content: `Estructura de navegación sofisticada: ${navigationAnalysis.navCount} elementos de navegación`,
        details: navigationAnalysis,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 2. Detección de patrones URL avanzados
    const urlPatterns = this.analyzeUrlPatterns();
    if (urlPatterns.suspicious.length > 0 && clues.length < 3) {
      clues.push({
        type: 'url-patterns',
        content: `Patrones URL inusuales detectados: ${urlPatterns.suspicious.length} enlaces`,
        patterns: urlPatterns,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 3. Análisis de estructura de sitio web
    const siteStructure = this.analyzeSiteStructure();
    if (siteStructure.hasDeepStructure && clues.length < 4) {
      clues.push({
        type: 'site-structure',
        content: `Estructura de sitio profunda detectada: ${siteStructure.maxDepth} niveles`,
        structure: siteStructure,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 4. Detección de rutas ocultas o elementos de navegación
    const hiddenRoutes = this.findHiddenRoutes();
    if (hiddenRoutes.length > 0 && clues.length < 5) {
      clues.push({
        type: 'hidden-routes',
        content: `Rutas potencialmente ocultas detectadas: ${hiddenRoutes.length} rutas`,
        routes: hiddenRoutes,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    // 5. Análisis de patrones de dominio y subdominio
    const domainAnalysis = this.analyzeDomainPatterns();
    if (domainAnalysis.hasPatterns && clues.length < 6) {
      clues.push({
        type: 'domain-patterns',
        content: `Patrones de dominio detectados: ${domainAnalysis.patterns.length} patrones`,
        analysis: domainAnalysis,
        source: window.location.href,
        timestamp: Date.now()
      });
    }
    
    return clues;
  }
  
  // Métodos auxiliares para el Navegador
  analyzeNavigationStructure() {
    const navElements = document.querySelectorAll('nav, [role="navigation"], .navigation, #navigation, .nav, #nav');
    const breadcrumbs = document.querySelectorAll('.breadcrumb, .breadcrumbs, [aria-label*="breadcrumb"]');
    const menus = document.querySelectorAll('.menu, .main-menu, .navigation-menu');
    
    const totalNavElements = navElements.length + breadcrumbs.length + menus.length;
    
    // Contar enlaces en navegación
    let totalNavLinks = 0;
    navElements.forEach(nav => {
      totalNavLinks += nav.querySelectorAll('a').length;
    });
    
    return {
      isComplex: totalNavElements > 2 || totalNavLinks > 15,
      navCount: totalNavElements,
      linkCount: totalNavLinks,
      hasBreadcrumbs: breadcrumbs.length > 0,
      hasMultipleMenus: menus.length > 1
    };
  }
  
  analyzeUrlPatterns() {
    const links = document.querySelectorAll('a[href]');
    const suspicious = [];
    const patterns = [];
    
    links.forEach(link => {
      const href = link.href;
      
      // Patrones sospechosos
      if (this.isSuspiciousUrl(href)) {
        suspicious.push({
          url: href,
          text: link.textContent.trim().substring(0, 30),
          reason: this.getUrlSuspiciousReason(href)
        });
      }
      
      // Análisis de patrones
      const pattern = this.extractUrlPattern(href);
      if (pattern) {
        patterns.push(pattern);
      }
    });
    
    return {
      suspicious: suspicious.slice(0, 5),
      patterns: [...new Set(patterns)],
      totalLinks: links.length
    };
  }
  
  isSuspiciousUrl(url) {
    const suspiciousPatterns = [
      /\?code=/,
      /\?key=/,
      /\?token=/,
      /\?secret=/,
      /\?hash=/,
      /#[a-zA-Z0-9]{20,}/,
      /\/api\/v\d+/,
      /\/hidden/,
      /\/admin/,
      /\/secret/,
      /\/debug/,
      /\/(.*\.php\?.*=.*)/,
      /\/(.*\.asp\?.*=.*)/
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(url));
  }
  
  getUrlSuspiciousReason(url) {
    if (url.includes('?code=')) return 'Parámetro de código';
    if (url.includes('?key=')) return 'Parámetro de clave';
    if (url.includes('?token=')) return 'Token de acceso';
    if (url.includes('#') && url.split('#')[1].length > 20) return 'Hash fragment largo';
    if (url.includes('/api/')) return 'Endpoint de API';
    if (url.includes('/admin')) return 'Área administrativa';
    if (url.includes('/hidden')) return 'Ruta oculta';
    return 'Patrón inusual';
  }
  
  extractUrlPattern(url) {
    try {
      const urlObj = new URL(url);
      
      // Extraer patrón de la ruta
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length > 2) {
        return `/${pathParts[0]}/${pathParts[1]}/...`;
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }
  
  analyzeSiteStructure() {
    const currentUrl = window.location.href;
    const pathParts = window.location.pathname.split('/').filter(part => part.length > 0);
    
    const links = document.querySelectorAll('a[href]');
    const internalLinks = [];
    
    links.forEach(link => {
      try {
        const linkUrl = new URL(link.href);
        if (linkUrl.hostname === window.location.hostname) {
          const linkPath = linkUrl.pathname.split('/').filter(part => part.length > 0);
          internalLinks.push({
            path: linkPath,
            depth: linkPath.length
          });
        }
      } catch (e) {
        // URL relativa o inválida
      }
    });
    
    const maxDepth = Math.max(...internalLinks.map(link => link.depth), pathParts.length);
    const avgDepth = internalLinks.length > 0 ? 
      internalLinks.reduce((sum, link) => sum + link.depth, 0) / internalLinks.length : 0;
    
    return {
      hasDeepStructure: maxDepth > 3,
      maxDepth: maxDepth,
      avgDepth: Math.round(avgDepth * 100) / 100,
      internalLinksCount: internalLinks.length,
      currentDepth: pathParts.length
    };
  }
  
  findHiddenRoutes() {
    const routes = [];
    
    // Buscar en comentarios HTML
    const htmlContent = document.documentElement.outerHTML;
    const commentRoutes = htmlContent.match(/<!--.*?(?:href|url|link|route).*?-->/gi);
    
    if (commentRoutes) {
      commentRoutes.forEach(comment => {
        const urlMatch = comment.match(/(?:href|url|link|route)=["']([^"']+)["']/i);
        if (urlMatch && urlMatch[1]) {
          routes.push({
            type: 'comment-route',
            route: urlMatch[1],
            context: comment.substring(0, 100)
          });
        }
      });
    }
    
    // Buscar en JavaScript inline
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      if (script.textContent) {
        const jsRoutes = script.textContent.match(/["']\/[a-zA-Z0-9\/_-]+["']/g);
        if (jsRoutes) {
          jsRoutes.forEach(route => {
            const cleanRoute = route.replace(/['"]/g, '');
            if (cleanRoute.length > 3 && cleanRoute.split('/').length > 2) {
              routes.push({
                type: 'js-route',
                route: cleanRoute,
                context: 'JavaScript code'
              });
            }
          });
        }
      }
    });
    
    // Buscar formularios con acciones inusuales
    const forms = document.querySelectorAll('form[action]');
    forms.forEach(form => {
      const action = form.getAttribute('action');
      if (action && this.isSuspiciousUrl(action)) {
        routes.push({
          type: 'form-action',
          route: action,
          context: 'Form action'
        });
      }
    });
    
    return routes.slice(0, 10);
  }
  
  analyzeDomainPatterns() {
    const currentDomain = window.location.hostname;
    const links = document.querySelectorAll('a[href]');
    const domains = new Set();
    const subdomains = new Set();
    
    links.forEach(link => {
      try {
        const url = new URL(link.href);
        domains.add(url.hostname);
        
        // Analizar subdominios
        if (url.hostname.includes('.') && url.hostname !== currentDomain) {
          const parts = url.hostname.split('.');
          if (parts.length > 2) {
            subdomains.add(parts[0]);
          }
        }
      } catch (e) {
        // Ignorar URLs inválidas
      }
    });
    
    const patterns = [];
    
    // Buscar patrones en subdominios
    const subdomainArray = Array.from(subdomains);
    if (subdomainArray.length > 3) {
      patterns.push(`Múltiples subdominios: ${subdomainArray.length}`);
    }
    
    // Buscar patrones en dominios externos
    const externalDomains = Array.from(domains).filter(d => d !== currentDomain);
    if (externalDomains.length > 5) {
      patterns.push(`Múltiples dominios externos: ${externalDomains.length}`);
    }
    
    return {
      hasPatterns: patterns.length > 0,
      patterns: patterns,
      totalDomains: domains.size,
      subdomainCount: subdomains.size,
      externalDomainCount: externalDomains.length
    };
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
    if (window.getComputedStyle(marker).position === 'fixed') {
      tooltip.style.position = 'fixed';
      tooltip.style.right = '90px';
      tooltip.style.bottom = '30px';
      tooltip.style.left = 'auto';
      tooltip.style.top = 'auto';
    } else {
      tooltip.style.left = `${markerRect.right + 10 + window.scrollX}px`;
      tooltip.style.top = `${markerRect.top + window.scrollY}px`;
    }
    
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
    
    // Enviar mensaje al background script con la URL actual
    chrome.runtime.sendMessage({
      action: 'clueDiscovered',
      clue: clueInfo,
      currentUrl: window.location.href
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