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
  function carregar(arquivo) {
    fetch(arquivo)
      .then(res => res.text())
      .then(html => {
        document.getElementById('top-bar').innerHTML = html;
      });
  }

// Link para orçamento
  function carregar(arquivo) {
    fetch(arquivo)
      .then(res => res.text())
      .then(html => {
        document.getElementById('orçamento').innerHTML = html;
      });
  }

// Link para footer
  function carregar(arquivo) {
    fetch(arquivo)
      .then(res => res.text())
      .then(html => {
        document.getElementById('footer').innerHTML = html;
      });
  }