// 1. Clean up any previous instance running under this ID
const currentInstanceId = typeof instanceId !== 'undefined' ? instanceId : '{{instanceId}}';

if (window.supercomponentCleanups && window.supercomponentCleanups[currentInstanceId]) {
    window.supercomponentCleanups[currentInstanceId]();
}

let animationFrameId = null;
let resizeHandler = null;
let textTimer = null;

function init() {
    // 2. Select Container safely
    let root = null;
    if (typeof currentInstanceId !== 'undefined' && currentInstanceId && currentInstanceId !== '{{instanceId}}') {
        root = document.querySelector(`[data-instance-id="${currentInstanceId}"]`) ||
               document.querySelector(`.elementor-element-${currentInstanceId}`);
    }
    if (!root) {
        root = document.querySelector(`[data-instance-id="{{instanceId}}"]`) ||
               document.querySelector(`.elementor-element-{{instanceId}}`) ||
               document.querySelector('.dentea-core');
    }
    if (!root) return;

    // 3. Extract dynamic slide data from the repeater markup
    const dataNodes = root.querySelectorAll(".dentea-core-data-item");
    const data = [];

    dataNodes.forEach(function (node) {
        const rawTreatments = (node.getAttribute("data-treatments") || "").trim();
        const treatmentsList = rawTreatments
            ? rawTreatments.split("\n").map(function (s) { return s.trim(); }).filter(Boolean)
            : [];

        data.push({
            title: node.getAttribute("data-title") || "",
            intro: node.getAttribute("data-intro") || "",
            treatments: treatmentsList,
            link: node.getAttribute("data-link") || "#",
            target: node.getAttribute("data-target") || "_self",
            isVideo: node.getAttribute("data-is-video") === "yes",
            videoUrl: node.getAttribute("data-video-url") || ""
        });
    });

    if (!data.length) return;

    // 4. Select interactive elements
    const track = root.querySelector(".dentea-core-track");
    const imageLayers = Array.from(root.querySelectorAll(".dentea-core-image"));
    const title = root.querySelector('[id^="denteaCoreTitle"]') || root.querySelector('.dentea-core-title');
    const intro = root.querySelector('[id^="denteaCoreIntro"]') || root.querySelector('.dentea-core-intro-text');
    const treatments = root.querySelector('[id^="denteaCoreTreatments"]') || root.querySelector('.dentea-core-treatments');
    const learnBtn = root.querySelector('[id^="denteaCoreLearn"]') || root.querySelector('.dentea-core-learn');
    const number = root.querySelector('[id^="denteaCoreNumber"] span') || root.querySelector('.dentea-core-number span') || root.querySelector('[id^="denteaCoreNumber"]');
    const progress = root.querySelector('[id^="denteaCoreProgress"]') || root.querySelector('.dentea-core-progress-bar');

    if (!track || !imageLayers.length) return;

    // 5. Video Setup & Settings
    const globalAutoplay = root.getAttribute("data-video-autoplay") !== "no";
    const globalLoop = root.getAttribute("data-video-loop") !== "no";
    const globalMuted = root.getAttribute("data-video-muted") !== "no";
    const globalPlaysinline = root.getAttribute("data-video-playsinline") !== "no";
    const globalControls = root.getAttribute("data-video-controls") === "yes";

    const allVideos = Array.from(root.querySelectorAll(".dentea-core-image video"));
    allVideos.forEach(function (video) {
        if (globalPlaysinline) {
            video.setAttribute("playsinline", "");
            video.setAttribute("webkit-playsinline", "");
        }
        if (globalMuted) {
            video.muted = true;
            video.setAttribute("muted", "");
        }
        if (globalLoop) {
            video.loop = true;
            video.setAttribute("loop", "");
        }
        video.controls = globalControls;
        video.preload = "auto";
    });

    let scrollTarget = 0;
    let scrollSmooth = 0;
    let previousIndex = -1;
    let currentIndex = 0;

    function getProgress() {
        const rect = track.getBoundingClientRect();
        const total = track.offsetHeight - window.innerHeight;
        if (total <= 0) return 0;
        return Math.max(0, Math.min(1, -rect.top / total));
    }

    function setContent(index) {
        const item = data[index];
        if (!item) return;

        if (title) title.classList.add("change");
        if (intro) intro.classList.add("change");

        clearTimeout(textTimer);

        textTimer = setTimeout(function () {
            if (title) {
                title.textContent = item.title;
                title.classList.remove("change");
            }

            if (intro) {
                intro.textContent = item.intro;
                intro.classList.remove("change");
            }

            if (treatments) {
                treatments.innerHTML = item.treatments.map(function (itemText) {
                    return `
                        <div class="dentea-core-treatment sc-treatment_typography">
                            ${itemText}
                            <span class="dentea-core-arrow">↗</span>
                        </div>
                    `;
                }).join("");
            }

            if (learnBtn) {
                learnBtn.setAttribute("href", item.link || "#");
                learnBtn.setAttribute("target", item.target || "_self");
                if (item.target === "_blank") {
                    learnBtn.setAttribute("rel", "noopener noreferrer");
                } else {
                    learnBtn.removeAttribute("rel");
                }
            }

            if (number) {
                number.textContent = String(index + 1).padStart(2, "0");
            }
        }, 140);
    }

    function syncVideoPlayback(currentIdx, nextIdx, fraction) {
        if (!allVideos.length) return;

        allVideos.forEach(function (video) {
            const layer = video.closest(".dentea-core-image");
            if (!layer) return;
            const slideIdx = parseInt(layer.getAttribute("data-slide-index") || "-1", 10);
            const isVisible = (slideIdx === currentIdx) || (slideIdx === nextIdx && fraction > 0.02);

            if (isVisible) {
                if (globalAutoplay && video.paused && video.src) {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(function () {
                            // Autoplay policy prevented or user paused
                        });
                    }
                }
            } else {
                // Pause inactive videos to preserve performance and mobile battery
                if (!video.paused) {
                    video.pause();
                }
            }
        });
    }

    function renderImages(progressValue) {
        const max = data.length - 1;
        const exact = progressValue * max;
        const base = Math.floor(exact);
        const fraction = exact - base;

        const current = Math.min(base, max);
        const next = Math.min(base + 1, max);

        imageLayers.forEach(function (layer) {
            layer.style.opacity = "0";
            layer.style.zIndex = "1";
            layer.style.clipPath = "inset(100% 0 0 0)";
            layer.style.transform = "scale(1.035)";

            const media = layer.querySelector("img, video");
            if (media) {
                media.style.transform = "scale(1.045)";
            }
        });

        // Stationary current layer
        const currentLayer = imageLayers[current];
        if (currentLayer) {
            currentLayer.style.opacity = "1";
            currentLayer.style.zIndex = "5";
            currentLayer.style.clipPath = "inset(0 0 0 0)";
            currentLayer.style.transform = `scale(${1.035 - fraction * 0.015})`;

            const media = currentLayer.querySelector("img, video");
            if (media) {
                media.style.transform = `scale(${1.045 - fraction * 0.025})`;
            }
        }

        // Overlay revealing layer
        if (next !== current) {
            const nextLayer = imageLayers[next];
            if (nextLayer) {
                nextLayer.style.opacity = "1";
                nextLayer.style.zIndex = "10";

                const hidden = (1 - fraction) * 100;
                nextLayer.style.clipPath = `inset(${hidden}% 0 0 0)`;
                nextLayer.style.transform = `scale(${1.055 - fraction * 0.02})`;

                const media = nextLayer.querySelector("img, video");
                if (media) {
                    const mediaScale = 1.065 - fraction * 0.035;
                    media.style.transform = `scale(${mediaScale})`;
                }
            }
        }

        // Manage active video playback
        syncVideoPlayback(current, next, fraction);

        // Switch dominant content
        const rounded = Math.round(exact);
        if (rounded !== currentIndex) {
            previousIndex = currentIndex;
            currentIndex = Math.min(rounded, max);
            setContent(currentIndex);
        }

        if (progressValue < 0.001 && currentIndex !== 0) {
            currentIndex = 0;
            previousIndex = 0;
            setContent(0);
        }
    }

    function animate() {
        scrollTarget = getProgress();
        scrollSmooth += (scrollTarget - scrollSmooth) * 0.08;

        renderImages(scrollSmooth);

        if (progress) {
            progress.style.width = (scrollSmooth * 100) + "%";
        }

        animationFrameId = requestAnimationFrame(animate);
    }

    // Initialize initial state
    setContent(0);
    renderImages(0);
    animate();

    resizeHandler = function () {
        scrollTarget = getProgress();
    };
    window.addEventListener("resize", resizeHandler, { passive: true });
}

// 6. Register Cleanup handler for memory leak prevention in Elementor live editor
window.supercomponentCleanups = window.supercomponentCleanups || {};
window.supercomponentCleanups[currentInstanceId] = function () {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
        resizeHandler = null;
    }
    if (textTimer) {
        clearTimeout(textTimer);
        textTimer = null;
    }

    // Pause all playing videos
    const root = document.querySelector(`[data-instance-id="${currentInstanceId}"]`) ||
                 document.querySelector(`.elementor-element-${currentInstanceId}`);
    if (root) {
        const vids = root.querySelectorAll("video");
        vids.forEach(function (v) {
            try { v.pause(); } catch (e) {}
        });
    }
};

// 7. Run instance
init();
