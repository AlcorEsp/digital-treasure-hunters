// Script para la página de bienvenida
document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('get-started-btn');
  
  if (startButton) {
    startButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Enviar mensaje al background script para abrir selección de rol
      chrome.runtime.sendMessage({ action: 'openRoleSelection' });
      
      // Cerrar esta pestaña (opcional, dependiendo de la experiencia deseada)
      window.close();
    });
  }
});
