/* ======================================================== */
/* 🚀 LANDING PAGE SCRIPT (landing.js)                      */
/* ======================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');

    // Adiciona uma sombra na Navbar ao dar scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
});