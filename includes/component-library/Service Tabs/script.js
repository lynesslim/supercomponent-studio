(function () {
    // 1. Cleanup previous instance when rebuilt in Elementor live editor
    if (window.supercomponentCleanups && window.supercomponentCleanups[instanceId]) {
        window.supercomponentCleanups[instanceId]();
    }

    const container = document.querySelector(`[data-instance-id="${instanceId}"]`) ||
                      document.querySelector(`#supercomponent-${instanceId}`) ||
                      document.querySelector(`.elementor-element-${instanceId}`);

    if (!container) return;

    const tabs = container.querySelectorAll('.service-tab');
    if (!tabs.length) return;

    // Ensure at least one tab is active initially
    let hasActive = false;
    tabs.forEach(function (tab) {
        if (tab.classList.contains('active')) {
            hasActive = true;
        }
    });

    if (!hasActive && tabs[0]) {
        tabs[0].classList.add('active');
    }

    const clickHandlers = [];

    tabs.forEach(function (tab) {
        const handler = function () {
            if (tab.classList.contains('active')) {
                return;
            }

            tabs.forEach(function (item) {
                item.classList.remove('active');
            });

            requestAnimationFrame(function () {
                tab.classList.add('active');
            });
        };

        tab.addEventListener('click', handler);
        clickHandlers.push({ element: tab, handler: handler });
    });

    // 2. Register cleanup handler for live rebuilds / memory leak prevention
    window.supercomponentCleanups = window.supercomponentCleanups || {};
    window.supercomponentCleanups[instanceId] = function () {
        clickHandlers.forEach(function (entry) {
            entry.element.removeEventListener('click', entry.handler);
        });
    };
})();
