(function() {
  // 1. Memory leak prevention: Clean up previous instance running under this instanceId
  if (typeof instanceId !== 'undefined' && window.supercomponentCleanups && window.supercomponentCleanups[instanceId]) {
    window.supercomponentCleanups[instanceId]();
  }

  const currentInstanceId = typeof instanceId !== 'undefined' ? instanceId : 'default';
  let mmInstance = null;
  let scrollTriggerInstance = null;

  function loadGSAP(callback) {
    if (window.gsap && window.ScrollTrigger) {
      callback();
      return;
    }

    const loadScript = (src, check) => new Promise((resolve) => {
      if (check()) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', () => !!window.gsap)
      .then(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js', () => !!window.ScrollTrigger))
      .then(() => callback());
  }

  function init(passedSettings) {
    const container = document.querySelector(`[data-instance-id="${currentInstanceId}"]`) ||
                      document.querySelector(`#supercomponent-${currentInstanceId}`) ||
                      document.querySelector(`.elementor-element-${currentInstanceId}`) ||
                      document.querySelector('.el-hs-wrapper') ||
                      document.querySelector('#elHsWrapper');
    if (!container) return;

    let settings = passedSettings || {};
    if (!passedSettings) {
      try {
        const rawSettings = container.getAttribute('data-settings');
        if (rawSettings) settings = JSON.parse(rawSettings);
      } catch (e) {
        console.warn('SuperComponent: Failed to parse settings', e);
      }
    }

    gsap.registerPlugin(ScrollTrigger);

    const stage = container.querySelector('.el-hs-pin-stage');
    const track = container.querySelector('.el-hs-track');

    if (!stage || !track) return;

    // Clean up previous matchMedia instance if any
    if (mmInstance) {
      mmInstance.revert();
      mmInstance = null;
    }
    if (scrollTriggerInstance) {
      scrollTriggerInstance.kill();
      scrollTriggerInstance = null;
    }

    mmInstance = gsap.matchMedia();

    const pinOffset = (settings.pin_start_offset && typeof settings.pin_start_offset.size !== 'undefined')
      ? settings.pin_start_offset.size
      : (typeof settings.pin_start_offset === 'number' ? settings.pin_start_offset : 0);

    const scrubVal = (settings.scrub_speed && typeof settings.scrub_speed.size !== 'undefined')
      ? settings.scrub_speed.size
      : (typeof settings.scrub_speed === 'number' ? settings.scrub_speed : 1);

    const breakpointMode = settings.pin_breakpoint || '768';
    let mediaQuery = '(min-width: 768px)';
    if (breakpointMode === '1025') {
      mediaQuery = '(min-width: 1025px)';
    } else if (breakpointMode === 'all') {
      mediaQuery = '(min-width: 0px)';
    }

    const startTrigger = (pinOffset > 0) ? `top ${pinOffset}px` : 'top top';

    mmInstance.add(mediaQuery, () => {
      // Calculate scroll distance: total track width minus visible stage width
      const getScrollAmount = () => -(track.scrollWidth - stage.clientWidth);

      const tween = gsap.to(track, {
        x: getScrollAmount,
        ease: 'none'
      });

      scrollTriggerInstance = ScrollTrigger.create({
        trigger: stage,
        start: startTrigger,
        end: () => `+=${Math.max(200, Math.abs(getScrollAmount()))}`,
        pin: true,
        pinSpacing: true,
        animation: tween,
        scrub: scrubVal,
        anticipatePin: 1,
        invalidateOnRefresh: true
      });
    });

    if (breakpointMode !== 'all') {
      const mobileQuery = breakpointMode === '1025' ? '(max-width: 1024px)' : '(max-width: 767px)';
      mmInstance.add(mobileQuery, () => {
        // Clear transforms on small screens for native swipe scroll
        gsap.set(track, { clearProps: 'all' });
      });
    }

    // Refresh triggers to ensure exact dimensions after images/fonts load
    setTimeout(() => { ScrollTrigger.refresh(); }, 150);
    setTimeout(() => { ScrollTrigger.refresh(); }, 600);
    setTimeout(() => { ScrollTrigger.refresh(); }, 1500);
  }

  // Cleanup handler for live re-renders
  window.supercomponentCleanups = window.supercomponentCleanups || {};
  window.supercomponentCleanups[currentInstanceId] = function() {
    if (scrollTriggerInstance) {
      scrollTriggerInstance.kill();
      scrollTriggerInstance = null;
    }
    if (mmInstance) {
      mmInstance.revert();
      mmInstance = null;
    }
  };

  // Listen for live Elementor editor setting updates on both window and parent window
  function handleUpdate(e) {
    if (e.detail && (e.detail.instanceId === currentInstanceId || !currentInstanceId)) {
      if (window.supercomponentCleanups && window.supercomponentCleanups[currentInstanceId]) {
        window.supercomponentCleanups[currentInstanceId]();
      }
      loadGSAP(function() {
        init(e.detail.settings);
      });
    }
  }

  window.addEventListener('supercomponent:update', handleUpdate);
  if (window.parent && window.parent !== window) {
    try {
      window.parent.addEventListener('supercomponent:update', handleUpdate);
    } catch (err) {}
  }

  window.addEventListener('load', () => {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
  window.addEventListener('resize', () => {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });

  loadGSAP(init);
})();
