(function() {
  // 1. Memory leak prevention: Clean up previous instance running under this instanceId
  if (window.supercomponentCleanups && window.supercomponentCleanups[instanceId]) {
    window.supercomponentCleanups[instanceId]();
  }

  let scrollTriggerInstance = null;
  let animationTimeline = null;

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

    loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', () => !!window.gsap)
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js', () => !!window.ScrollTrigger))
      .then(() => callback());
  }

  function init(passedSettings) {
    const container = document.querySelector(`[data-instance-id="${instanceId}"]`) ||
                      document.querySelector(`#supercomponent-${instanceId}`) ||
                      document.querySelector(`.elementor-element-${instanceId}`);
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

    const defaultStages = [
      { number: '01', title: 'Material selection', body: 'We begin by choosing materials for performance, tactility and long-term durability.' },
      { number: '02', title: 'Precision shaping', body: 'Each component is formed with controlled tolerances to preserve the intended geometry.' },
      { number: '03', title: 'Surface refinement', body: 'Textures and finishes are developed to create depth, grip and a distinctive visual rhythm.' },
      { number: '04', title: 'System assembly', body: 'Individual parts are aligned and assembled into one coherent, high-performance structure.' },
      { number: '05', title: 'Final validation', body: 'The complete product is tested, adjusted and approved before it reaches its final form.' }
    ];

    const stages = (settings.stages && Array.isArray(settings.stages) && settings.stages.length > 0)
      ? settings.stages
      : defaultStages;

    gsap.registerPlugin(ScrollTrigger);

    const stage = container.querySelector('.dial-stage');
    const dot = container.querySelector('.dial__dot');
    const labelsWrap = container.querySelector('.dial__labels');
    const title = container.querySelector('.dial-content__title');
    const body = container.querySelector('.dial-content__body');
    const counterCurrent = container.querySelector('.dial-content__counter .current');
    const counterTotal = container.querySelector('.dial-content__counter .total');

    if (!stage || !labelsWrap) return;

    if (counterTotal) {
      counterTotal.textContent = String(stages.length).padStart(2, '0');
    }

    const CX = 500;
    const CY = 500;
    const R = 430;
    const ACTIVE_ANGLE = 0;
    const STAGE_START_ANGLE = -56;
    const STAGE_END_ANGLE = 56;

    const toRad = deg => deg * Math.PI / 180;
    const stageAngle = index => {
      if (stages.length <= 1) return 0;
      return STAGE_START_ANGLE + (STAGE_END_ANGLE - STAGE_START_ANGLE) * (index / (stages.length - 1));
    };

    function pointOnCircle(angle, radius = R) {
      const a = toRad(angle);
      return {
        x: CX + Math.cos(a) * radius,
        y: CY + Math.sin(a) * radius
      };
    }

    labelsWrap.innerHTML = '';
    const stageLabels = [];

    stages.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'dial__label';
      el.textContent = item.number || String(index + 1).padStart(2, '0');
      el.dataset.index = index;
      labelsWrap.appendChild(el);
      stageLabels.push(el);
    });

    function setElementOnCircle(el, angle, radius) {
      const point = pointOnCircle(angle, radius);
      el.style.left = `${point.x / 10}%`;
      el.style.top = `${point.y / 10}%`;
    }

    function updateDial(stagePosition) {
      const totalStages = Math.max(1, stages.length - 1);
      const interpolatedSourceAngle = STAGE_START_ANGLE +
        (STAGE_END_ANGLE - STAGE_START_ANGLE) * (stagePosition / totalStages);
      const rotationOffset = ACTIVE_ANGLE - interpolatedSourceAngle;

      stageLabels.forEach((label, index) => {
        setElementOnCircle(label, stageAngle(index) + rotationOffset, R + 62);
      });
    }

    if (dot) {
      const fixedDot = pointOnCircle(ACTIVE_ANGLE, R);
      dot.setAttribute('cx', fixedDot.x);
      dot.setAttribute('cy', fixedDot.y);
    }

    let activeIndex = -1;

    function updateActive(stagePosition) {
      const index = Math.max(0, Math.min(stages.length - 1, Math.round(stagePosition)));
      if (index === activeIndex) return;
      activeIndex = index;

      stageLabels.forEach((label, i) => {
        label.classList.toggle('is-active', i === index);
        gsap.to(label, {
          scale: i === index ? 1.22 : 1,
          opacity: i === index ? 1 : .46,
          duration: .25,
          overwrite: true
        });
      });

      const next = stages[index];
      if (!next) return;

      const outgoing = [];
      if (title) outgoing.push(title);
      if (body) outgoing.push(body);
      if (counterCurrent) outgoing.push(counterCurrent);

      if (outgoing.length > 0) {
        gsap.to(outgoing, {
          y: -12,
          opacity: 0,
          duration: .16,
          stagger: .02,
          overwrite: true,
          onComplete: () => {
            if (title) title.textContent = next.title || '';
            if (body) body.textContent = next.body || '';
            if (counterCurrent) counterCurrent.textContent = next.number || String(index + 1).padStart(2, '0');
            gsap.fromTo(outgoing,
              { y: 16, opacity: 0 },
              { y: 0, opacity: 1, duration: .28, stagger: .035, ease: 'power2.out', overwrite: true }
            );
          }
        });
      }
    }

    updateDial(0);
    updateActive(0);

    const state = { stagePosition: 0 };
    const scrubDist = (settings.scrub_distance && settings.scrub_distance.size) ? settings.scrub_distance.size : 900;
    const totalScroll = stages.length * scrubDist;

    animationTimeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: `+=${totalScroll}`,
        scrub: 0.55,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        snap: stages.length > 1 ? {
          snapTo: 1 / (stages.length - 1),
          duration: { min: 0.12, max: 0.35 },
          delay: 0.05,
          ease: 'power1.inOut'
        } : false
      }
    })
    .to(state, {
      stagePosition: stages.length - 1,
      duration: 1,
      onUpdate: () => {
        updateDial(state.stagePosition);
        updateActive(state.stagePosition);
      }
    }, 0);

    scrollTriggerInstance = animationTimeline.scrollTrigger;
  }

  // Cleanup handler for live re-renders
  window.supercomponentCleanups = window.supercomponentCleanups || {};
  window.supercomponentCleanups[instanceId] = function() {
    if (animationTimeline) {
      animationTimeline.kill();
    }
    if (scrollTriggerInstance) {
      scrollTriggerInstance.kill();
    }
  };

  // Listen for live Elementor editor setting updates
  window.addEventListener('supercomponent:update', function(e) {
    if (e.detail && e.detail.instanceId === instanceId) {
      if (window.supercomponentCleanups && window.supercomponentCleanups[instanceId]) {
        window.supercomponentCleanups[instanceId]();
      }
      loadGSAP(function() {
        init(e.detail.settings);
      });
    }
  });

  loadGSAP(init);
})();
