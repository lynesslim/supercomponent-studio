(function () {
    // Memory leak prevention / live rebuild cleanup in Elementor Editor
    if (window.supercomponentCleanups && window.supercomponentCleanups[instanceId]) {
        window.supercomponentCleanups[instanceId]();
    }

    const container = document.querySelector(`[data-instance-id="${instanceId}"]`) ||
                      document.querySelector(`#supercomponent-${instanceId}`) ||
                      document.querySelector(`.elementor-element-${instanceId}`);

    if (!container) return;

    // Dynamically ensure z-index stacking order for any number of cards
    const cards = container.querySelectorAll('.interior-card');
    cards.forEach(function (card, index) {
        card.style.zIndex = index + 1;
    });

    window.supercomponentCleanups = window.supercomponentCleanups || {};
    window.supercomponentCleanups[instanceId] = function () {
        // Cleanup if needed
    };
})();
