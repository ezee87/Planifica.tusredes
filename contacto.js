(() => {
  'use strict';
  const form = document.forms.contacto;
  const button = form.querySelector('button');
  const status = document.querySelector('#form-status');
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    status.textContent = '';
    if (location.protocol === 'file:') {
      status.textContent = 'El envío está disponible en el sitio publicado. Esta copia local no envía consultas.';
      status.focus(); return;
    }
    pending = true; button.disabled = true; form.setAttribute('aria-busy','true');
    try {
      const response = await fetch('/', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString()});
      if (!response.ok) throw new Error('Envío rechazado');
      form.reset(); form.hidden = true;
      status.textContent = 'Consulta recibida. Te responderé por email dentro de las próximas 48 horas.';
    } catch {
      status.textContent = 'No se pudo confirmar el envío. Intentá nuevamente o escribí a soporte.planificatusredes@gmail.com.';
    } finally {
      pending = false; button.disabled = false; form.removeAttribute('aria-busy'); status.focus();
    }
  });
})();
