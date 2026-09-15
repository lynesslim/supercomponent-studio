// 1. Memory leak cleanup registration
const currentInstanceId = typeof instanceId !== 'undefined' ? instanceId : '{{instanceId}}';

if (window.supercomponentCleanups && window.supercomponentCleanups[currentInstanceId]) {
    window.supercomponentCleanups[currentInstanceId]();
}

let cleanupListeners = [];

function init() {
    let section = null;
    if (typeof currentInstanceId !== 'undefined' && currentInstanceId && currentInstanceId !== '{{instanceId}}') {
        section = document.querySelector(`[data-instance-id="${currentInstanceId}"]`) ||
                  document.querySelector(`.elementor-element-${currentInstanceId}`);
    }
    if (!section) {
        section = document.querySelector(`[data-instance-id="{{instanceId}}"]`) ||
                  document.querySelector(`.elementor-element-{{instanceId}}`) ||
                  document.querySelector('.framer-tab-section');
    }

    if (!section) return;

    const tabs = Array.from(section.querySelectorAll('.framer-tab'));
    if (!tabs.length) return;

    const hoverEnabled = section.getAttribute('data-hover') !== 'no';

    // Populate tags & cleanly handle optional capabilities container
    tabs.forEach(function (tab) {
        const rawTags = (tab.getAttribute('data-tags') || '').trim();
        const showCapAttr = tab.getAttribute('data-show-capabilities');
        const isCapDisabled = showCapAttr === 'no' || showCapAttr === 'false' || showCapAttr === 'off' || showCapAttr === '0';
        const tagContainer = tab.querySelector('.tab-tags');
        const capabilitiesContainer = tab.querySelector('.tab-capabilities');
        const offerLabel = tab.querySelector('.tab-offer');

        // If explicitly disabled via attribute, hide capabilities completely
        if (capabilitiesContainer && isCapDisabled) {
            capabilitiesContainer.style.display = 'none';
            return;
        }

        if (tagContainer) {
            if (rawTags) {
                const list = rawTags.includes('\n') ? rawTags.split('\n') : rawTags.split(',');
                const tagsList = list
                    .map(function(t) { return t.trim(); })
                    .filter(Boolean);

                if (tagsList.length > 0) {
                    tagContainer.innerHTML = tagsList
                        .map(function(t) {
                            return '<div class="tab-tag">' + t + '</div>';
                        })
                        .join('');
                    tagContainer.style.display = '';
                } else {
                    tagContainer.innerHTML = '';
                    tagContainer.style.display = 'none';
                }
            } else {
                tagContainer.innerHTML = '';
                tagContainer.style.display = 'none';
            }
        }

        // If capabilities container exists but has neither label nor tags, hide it cleanly
        if (capabilitiesContainer) {
            const hasLabel = offerLabel && offerLabel.textContent.trim().length > 0;
            const hasTags = tagContainer && tagContainer.children.length > 0;
            if (!hasLabel && !hasTags) {
                capabilitiesContainer.style.display = 'none';
            } else {
                capabilitiesContainer.style.display = '';
            }
        }
    });

    // Ensure initial active tab
    const hasActive = tabs.some(function (tab) { return tab.classList.contains('active'); });
    if (!hasActive && tabs[0]) {
        tabs[0].classList.add('active');
    }

    function activateTab(targetTab) {
        if (targetTab.classList.contains('active')) return;

        tabs.forEach(function (item) {
            item.classList.remove('active');
        });

        targetTab.classList.add('active');
    }

    let hoverTimer = null;

    tabs.forEach(function (tab) {
        // Click handler
        const onClick = function () {
            activateTab(tab);
        };
        tab.addEventListener('click', onClick);
        cleanupListeners.push(function () {
            tab.removeEventListener('click', onClick);
        });

        // Hover handler (smooth with short debounce to prevent jitter)
        if (hoverEnabled) {
            const onMouseEnter = function () {
                clearTimeout(hoverTimer);
                hoverTimer = setTimeout(function () {
                    activateTab(tab);
                }, 40);
            };
            tab.addEventListener('mouseenter', onMouseEnter);
            cleanupListeners.push(function () {
                tab.removeEventListener('mouseenter', onMouseEnter);
            });
        }
    });

    cleanupListeners.push(function () {
        if (hoverTimer) clearTimeout(hoverTimer);
    });
}

// 4. Register Cleanup Handler
window.supercomponentCleanups = window.supercomponentCleanups || {};
window.supercomponentCleanups[currentInstanceId] = function() {
    cleanupListeners.forEach(function (fn) { fn(); });
    cleanupListeners = [];
};

// 5. Run instance
init();
