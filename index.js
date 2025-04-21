
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault(); // Impede o comportamento padrão

        const targetId = this.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center' // Centraliza verticalmente
            });
        }
    });
});

// Seleciona o botão dentro do 'ul'
const toggleButton = document.querySelector('.menu-logo .menu-toggle');
// Seleciona o menu que será exibido/ocultado
const menu = document.querySelector('.menu');

// Adiciona o evento de clique no botão
toggleButton.addEventListener('click', (event) => {
  event.stopPropagation(); // Impede o clique no botão de fechar o menu imediatamente
  menu.classList.toggle('show'); // Alterna a classe 'show'
});

// Fecha o menu ao clicar fora dele
document.addEventListener('click', (event) => {
  // Verifica se o menu está aberto e se o clique foi fora dele
  if (menu.classList.contains('show') && !menu.contains(event.target)) {
    menu.classList.remove('show'); // Remove a classe 'show' para fechar o menu
  }
});

  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('mobileMenu');
    const toggle = document.getElementById('menuToggle');
    const close = document.getElementById('closeMenu');
    const links = document.querySelectorAll('.popup-link');

    toggle.addEventListener('click', () => {
      menu.classList.remove('hidden');
    });

    close.addEventListener('click', () => {
      menu.classList.add('hidden');
    });

    links.forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.add('hidden');
      });
    });

    // Marcar página atual
    const currentHash = window.location.hash;
    links.forEach(link => {
      if (link.getAttribute('href') === currentHash) {
        link.classList.add('active');
      }
    });
  });