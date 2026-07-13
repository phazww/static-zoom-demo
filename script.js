document.addEventListener("DOMContentLoaded", function () {
    let isNeutralizerActive = true;

    // Ссылки на элементы интерфейса
    const toggleBtn = document.getElementById("toggle-neutralizer");
    const zoomVal = document.getElementById("zoom-value");
    const textZoomVal = document.getElementById("text-zoom-value");
    const testInput = document.getElementById("test-input");
    const frame = document.getElementById("zoomFrame");

    let lastZoom = window.devicePixelRatio || 1;
    let lastLayoutZoom = 1;

    // Функция обновления и компенсации масштаба
    function updateLayout() {
        // 1. Считываем масштаб браузера / Windows
        const browserZoom = window.devicePixelRatio || 1;
        
        // 2. Считываем масштабирование текста (Firefox Zoom Text Only) через скрытый зонд
        const probe = document.getElementById("text-zoom-probe");
        let textZoomFactor = 1;
        if (probe) {
            const computedFontSize = parseFloat(window.getComputedStyle(probe).fontSize);
            if (Number.isFinite(computedFontSize) && computedFontSize > 0) {
                textZoomFactor = computedFontSize / 100;
            }
        }

        // Обновляем показатели в панели
        if (zoomVal) zoomVal.textContent = Math.round(browserZoom * 100) + "%";
        if (textZoomVal) textZoomVal.textContent = textZoomFactor.toFixed(2) + "x";

        if (!frame) return;

        // Сохраняем текущую позицию скролла для компенсации прыжка
        const currentScrollY = window.scrollY;

        // Различаем режим "Только текст" (Firefox) и обычный зум страницы
        const isTextOnlyZoom = Math.abs(textZoomFactor - 1) > 0.05;
        const layoutZoom = isTextOnlyZoom ? 1 : browserZoom;
        const fontCompensation = isTextOnlyZoom ? textZoomFactor : 1;

        if (isNeutralizerActive) {
            // Устанавливаем переменную компенсации текста для rem-шрифтов
            document.documentElement.style.setProperty("--text-zoom-factor", fontCompensation);

            const inv = 1 / layoutZoom;
            const wrapper = document.getElementById("zoomWrapper");
            
            // Проверяем поддержку CSS zoom (Firefox не поддерживает, остальные да)
            const supportsZoom = CSS.supports && CSS.supports("zoom", "1");
            
            if (!supportsZoom) {
                // Компенсация через transform: scale для Firefox
                frame.style.width = (layoutZoom * 100) + "%";
                frame.style.minHeight = (layoutZoom * 100) + "vh";
                frame.style.transform = "scale(" + inv + ")";
                frame.style.transformOrigin = "top left";
                frame.style.removeProperty("zoom");
                
                if (wrapper) {
                    const rect = frame.getBoundingClientRect();
                    wrapper.style.height = rect.height + "px";
                }
            } else {
                // Компенсация через zoom для Chrome/Safari/Edge/Opera/Yandex
                frame.style.width = "100%";
                frame.style.minHeight = (layoutZoom * 100) + "vh";
                frame.style.zoom = inv;
                frame.style.removeProperty("transform");
                frame.style.removeProperty("transform-origin");
                
                if (wrapper) {
                    wrapper.style.removeProperty("height");
                }
            }
            
            // Стабилизируем скролл на основе масштаба верстки
            if (Math.abs(layoutZoom - lastLayoutZoom) > 0.01) {
                const targetScrollY = currentScrollY * (lastLayoutZoom / layoutZoom);
                window.scrollTo(0, targetScrollY);
            }
        } else {
            // Выключаем компенсацию, возвращаем к стандартному поведению браузера
            document.documentElement.style.setProperty("--text-zoom-factor", 1);
            frame.style.removeProperty("zoom");
            frame.style.removeProperty("transform");
            frame.style.removeProperty("transform-origin");
            frame.style.removeProperty("width");
            frame.style.removeProperty("min-height");
        }

        lastZoom = browserZoom;
        lastLayoutZoom = layoutZoom;
    }

    // Кадровая фильтрация (requestAnimationFrame throttling) для предотвращения тряски
    let updateTick = false;
    function queueUpdateLayout() {
        if (!updateTick) {
            updateTick = true;
            requestAnimationFrame(() => {
                updateLayout();
                updateTick = false;
            });
        }
    }

    // Быстрый ResizeObserver для моментального отслеживания изменения размера шрифта без лагов
    const probe = document.getElementById("text-zoom-probe");
    if (probe && typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                // width = 10 * 100 * textZoomFactor = 1000 * textZoomFactor
                const width = entry.contentRect.width;
                if (width > 0) {
                    const textZoomFactor = width / 1000;
                    const isTextOnlyZoom = Math.abs(textZoomFactor - 1) > 0.05;
                    const fontCompensation = isTextOnlyZoom ? textZoomFactor : 1;
                    
                    if (isNeutralizerActive) {
                        document.documentElement.style.setProperty("--text-zoom-factor", fontCompensation);
                    }
                    if (textZoomVal) textZoomVal.textContent = textZoomFactor.toFixed(2) + "x";
                    
                    queueUpdateLayout();
                }
            }
        });
        observer.observe(probe);
    }

    // Слушатели событий масштабирования
    window.addEventListener("resize", queueUpdateLayout);
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", queueUpdateLayout);
    }
    
    // Регулярная проверка на случай, если события resize не сработали
    setInterval(queueUpdateLayout, 1000);

    // Инициализация при первой загрузке
    updateLayout();

    // Переключатель режима
    if (toggleBtn) {
        toggleBtn.addEventListener("click", function () {
            isNeutralizerActive = !isNeutralizerActive;
            if (isNeutralizerActive) {
                toggleBtn.textContent = "АКТИВЕН (Статика)";
                toggleBtn.classList.add("active");
            } else {
                toggleBtn.textContent = "ВЫКЛЮЧЕН (Обычный)";
                toggleBtn.classList.remove("active");
            }
            updateLayout();
        });
    }

    // Копирование в буфер для кнопок в таблице
    document.querySelectorAll(".btn-action").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const row = btn.closest("tr");
            const vacancy = row.querySelector(".font-bold").textContent;
            
            navigator.clipboard.writeText(vacancy).then(function () {
                const originalText = btn.textContent;
                btn.textContent = "Скопировано!";
                btn.style.backgroundColor = "var(--color-success)";
                btn.style.color = "white";
                
                setTimeout(function () {
                    btn.textContent = originalText;
                    btn.style.removeProperty("background-color");
                    btn.style.removeProperty("color");
                }, 1000);
            });
        });
    });
});
