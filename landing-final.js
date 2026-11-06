(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('#section-links');
  const mobile = matchMedia('(max-width:800px)');
  function close(returnFocus = false) {
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus();
  }
  toggle.hidden = false;
  document.documentElement.classList.add('menu-ready');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    if (open) links.querySelector('a').focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
  });
  links.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !mobile.matches) return;
    close();
    const section = document.querySelector(link.getAttribute('href'));
    section.setAttribute('tabindex', '-1');
    section.focus({preventScroll:true});
  });
  document.addEventListener('click', event => { if (!event.target.closest('.nav-links')) close(); });
  document.querySelector('.nav-links').addEventListener('focusout', event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  });
  mobile.addEventListener('change', () => {close(); window.dispatchEvent(new Event('resize'));});
  if (location.protocol === 'file:') document.querySelector('footer a[href="/contacto.html"]').href = 'contacto.html';
})();
