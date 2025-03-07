# Contribuyendo a Digital Treasure Hunters

¡Gracias por tu interés en contribuir a Digital Treasure Hunters! Este documento proporciona pautas y pasos para ayudarte a contribuir a este proyecto de manera efectiva.

## Índice
- [Código de conducta](#código-de-conducta)
- [Primeros pasos](#primeros-pasos)
- [Cómo contribuir](#cómo-contribuir)
  - [Reportar bugs](#reportar-bugs)
  - [Solicitar features](#solicitar-features)
  - [Contribuir con código](#contribuir-con-código)
- [Estilo de código](#estilo-de-código)
- [Proceso de revisión](#proceso-de-revisión)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Preguntas frecuentes](#preguntas-frecuentes)

## Código de conducta

Este proyecto sigue un [Código de Conducta](CODE_OF_CONDUCT.md). Al participar, se espera que respetes este código. Por favor, reporta comportamientos inaceptables a [tu-email@example.com].

## Primeros pasos

1. **Configura tu entorno de desarrollo**
   - Clona el repositorio
   - Instala la extensión en modo desarrollador (sigue las instrucciones en el [README.md](README.md))

2. **Familiarízate con la arquitectura**
   - Revisa la [estructura del proyecto](#estructura-del-proyecto)
   - Prueba la extensión para entender su funcionamiento

3. **Busca issues para empezar**
   - Las issues etiquetadas con ["good first issue"](https://github.com/tu-usuario/digital-treasure-hunters/labels/good%20first%20issue) son ideales para principiantes
   - Las issues marcadas como ["help wanted"](https://github.com/tu-usuario/digital-treasure-hunters/labels/help%20wanted) necesitan especialmente contribuciones

## Cómo contribuir

### Reportar bugs

Si encuentras un bug, por favor usa la [plantilla de issues para bugs](https://github.com/tu-usuario/digital-treasure-hunters/issues/new?template=bug_report.md) e incluye:

- Descripción clara del problema
- Pasos para reproducir el comportamiento
- Comportamiento esperado vs. actual
- Capturas de pantalla si es posible
- Información del entorno (navegador, sistema operativo, etc.)

### Solicitar features

Las solicitudes de nuevas características son bienvenidas. Por favor, usa la [plantilla de solicitud de funcionalidades](https://github.com/tu-usuario/digital-treasure-hunters/issues/new?template=feature_request.md) e incluye:

- Descripción clara de lo que te gustaría ver implementado
- Contexto sobre por qué esta funcionalidad sería útil
- Posibles implementaciones o ideas sobre cómo abordar la funcionalidad

### Contribuir con código

1. **Selecciona una issue** o crea una nueva para discutir la implementación que planeas
2. **Crea una rama** desde `main` con un nombre descriptivo:
   ```bash
   git checkout -b feature/nombre-descriptivo
   ```
   o
   ```bash
   git checkout -b fix/nombre-del-bug
   ```
3. **Implementa tus cambios** siguiendo el [estilo de código](#estilo-de-código)
4. **Prueba tus cambios** a fondo
5. **Envía un pull request** con una descripción clara de tus cambios

## Estilo de código

- **JavaScript**: Seguimos en general las convenciones de [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- **HTML/CSS**: Usa nombres de clases descriptivos y sigue el patrón BEM cuando sea posible
- **Comentarios**: Comenta el código cuando la lógica no sea evidente, especialmente para algoritmos complejos

### Ejemplos específicos

```javascript
// Preferimos esta sintaxis
const functionName = (param1, param2) => {
  // Lógica aquí
};

// Espaciado consistente en operadores
const sum = a + b;

// Nombres descriptivos para variables y funciones
const discoveredClues = [];
function handleRoleSelection() { /* ... */ }
```

## Proceso de revisión

1. Los PR son revisados por al menos un mantenedor
2. Se pueden solicitar cambios o mejoras
3. Una vez aprobados, los cambios se mejarán a la rama principal
4. Para cambios mayores, puede ser necesaria una revisión más extensa

## Estructura del proyecto

```
digital-treasure-hunters/
├── manifest.json           # Configuración principal de la extensión
├── background.js           # Script que se ejecuta en segundo plano
├── popup.html              # Interfaz principal de la extensión
├── popup.js                # Lógica del popup
├── popup.css               # Estilos del popup
├── popup-init.js           # Script de inicialización del popup
├── popup-detached.css      # Estilos para modo ventana
├── content.js              # Script que se ejecuta en las páginas web
├── content.css             # Estilos para los elementos inyectados
├── welcome.html            # Página de bienvenida para nuevos usuarios
├── welcome.js              # Script para la página de bienvenida
├── teams.html              # Página de gestión de equipos
├── teams.js                # Sistema de equipos y colaboración
├── teams-ui.js             # UI para gestión de equipos
├── teams.css               # Estilos para la página de equipos
├── missions.html           # Página de gestión de misiones
├── missions.js             # Sistema de misiones y desafíos
├── missions-ui.js          # UI para gestión de misiones
├── missions.css            # Estilos para la página de misiones
└── images/                 # Carpeta para iconos y recursos visuales
```

### Componentes principales

- **Sistema de detección de pistas**: Algoritmos para encontrar diferentes tipos de pistas basados en el rol del usuario.
- **Sistema de equipos**: Manejo de creación, unión y colaboración en equipos.
- **Sistema de misiones**: Gestión de objetivos, progreso y recompensas.
- **Interfaz de usuario**: Componentes visuales e interacciones.

## Preguntas frecuentes

**P: ¿Cómo puedo probar mi nueva característica de detección de pistas?**

R: Crea páginas web de prueba con contenido específico que debería activar tu algoritmo de detección. También puedes usar sitios existentes que tengan el tipo de contenido que estás intentando detectar.

**P: ¿Puedo contribuir si no tengo experiencia con extensiones de navegador?**

R: ¡Absolutamente! Puedes ayudar con mejoras de UI/UX, documentación, pruebas o incluso reportando bugs detallados.

**P: ¿Cómo manejo la comunicación entre diferentes scripts (background, content, popup)?**

R: Usa chrome.runtime.sendMessage() y chrome.tabs.sendMessage() para la comunicación. Consulta la documentación de Chrome para más detalles.

---

Si tienes alguna pregunta que no está cubierta aquí, no dudes en abrir una issue para discutirla. ¡Gracias por contribuir a Digital Treasure Hunters!
