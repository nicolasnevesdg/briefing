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

// Seleciona todas as imagens com a classe 'popup-image'
const popupImages = document.querySelectorAll('.popup-image');
const popupOverlay = document.createElement('div');
const popupContent = document.createElement('div');
const popupClose = document.createElement('button');
const popupPrev = document.createElement('button');
const popupNext = document.createElement('button');

// Configuração do overlay
popupOverlay.className = 'popup-overlay';
popupContent.className = 'popup-content';
popupClose.className = 'popup-close';
popupPrev.className = 'popup-nav popup-prev';
popupNext.className = 'popup-nav popup-next';

popupClose.innerText = '×';
popupPrev.innerText = '‹';
popupNext.innerText = '›';

// Adiciona os elementos ao DOM
popupOverlay.appendChild(popupContent);
popupContent.appendChild(popupClose);
document.body.appendChild(popupOverlay);
document.body.appendChild(popupPrev);
document.body.appendChild(popupNext);

let currentIndex = -1;
const imgList = Array.from(popupImages);

// Função para abrir o pop-up
imgList.forEach((image, index) => {
  image.addEventListener('click', () => {
    openPopup(index);
  });
});

function openPopup(index) {
  currentIndex = index;
  popupContent.querySelectorAll('img').forEach((img) => img.remove());

  const img = document.createElement('img');
  img.src = imgList[currentIndex].src;
  popupContent.appendChild(img);

  popupOverlay.style.display = 'flex';
  popupPrev.style.display = 'block';
  popupNext.style.display = 'block';
}

// Função para fechar o pop-up
function closePopup() {
  popupOverlay.style.display = 'none';
  popupPrev.style.display = 'none';
  popupNext.style.display = 'none';
  popupContent.querySelectorAll('img').forEach((img) => img.remove());
}

// Fecha o pop-up ao clicar no fundo preto
popupClose.addEventListener('click', closePopup);
popupOverlay.addEventListener('click', (e) => {
  if (e.target === popupOverlay) closePopup();
});


// Navegar entre imagens
popupPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentIndex > 0) openPopup(currentIndex - 1);
});

popupNext.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentIndex < imgList.length - 1) openPopup(currentIndex + 1);
});

// Link para top-bar
  fetch('top-bar.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('top-bar').innerHTML = html;
    });

// Link para orçamento
  fetch('orcamento.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('orcamento').innerHTML = html;
    });

// Link para footer
  fetch('footer.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('footer').innerHTML = html;
    });
	
// Botão "Ver mais projetos" / seta fixa
window.addEventListener('DOMContentLoaded', () => {
  const button = document.createElement('a');
  button.href = '/portfolio.html'; // Altere o caminho se necessário
  button.className = 'floating-back-button';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
</svg>

  `;

  const isMobile = window.innerWidth <= 768;
  button.innerHTML = isMobile ? 'Ver mais projetos' : svg;

  document.body.appendChild(button);

  // Atualiza se redimensionar a tela
  window.addEventListener('resize', () => {
    button.innerHTML = window.innerWidth <= 768 ? 'Ver mais projetos' : svg;
  });
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