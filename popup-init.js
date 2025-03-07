// Este script se carga primero y maneja la inicialización básica del popup
(function() {
  // Detectar si estamos en modo ventana independiente
  if (window.outerHeight > 600) {
    // Habilitar estilos de modo ventana
    const detachedStyles = document.getElementById('detached-styles');
    if (detachedStyles) {
      detachedStyles.disabled = false;
    }
  }
})();
