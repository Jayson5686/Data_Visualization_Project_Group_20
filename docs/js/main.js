const filterState = {
    year: "All",
    state: "All",
    metric: "Hospitalised_Injuries",
    trendMode: "single", // "single" | "multi" | "indexed"
    barMode: "raw",      // "raw" | "share"
    sort: "value-desc"
};

let rawStateData = [];

function getStateSummaryForSelectedYear() {
    const yearRows =
        filterState.year === "All"
            ? rawStateData
            : rawStateData.filter((d) => String(d.Year) === String(filterState.year));

    const states = Array.from(new Set(rawStateData.map((d) => d.State)));

    return states.map((st) => {
        const rows = yearRows.filter((d) => d.State === st);
        const injuries = d3.sum(rows, (d) => d.Hospitalised_Injuries);
        const bedDays = d3.sum(rows, (d) => d.Bed_Days);
        const avgBed = injuries > 0 ? bedDays / injuries : 0;
        return {
            State: st,
            Hospitalised_Injuries: injuries,
            Bed_Days: bedDays,
            Average_Bed_Days: avgBed
        };
    });
}

function updateKPIsAndFinding(stateSummary, nationalAvgBedDays) {
    const kpiRows = rawStateData.filter((d) => {
        const matchYear = filterState.year === "All" || String(d.Year) === String(filterState.year);
        const matchState = filterState.state === "All" || d.State === filterState.state;
        return matchYear && matchState;
    });

    const totalInjuries = d3.sum(kpiRows, (d) => d.Hospitalised_Injuries);
    const totalBedDays = d3.sum(kpiRows, (d) => d.Bed_Days);
    const weightedAvgBedDays = totalInjuries > 0 ? totalBedDays / totalInjuries : 0;

    document.getElementById("kpi-total-injuries").textContent = d3.format(",")(totalInjuries);
    document.getElementById("kpi-total-beddays").textContent = d3.format(",")(totalBedDays);
    document.getElementById("kpi-avg-beddays").textContent = weightedAvgBedDays.toFixed(2);

    // Accessible YoY / 10-year change with directional triangles (▲ / ▼) + non-red-green colours
    const injSub = document.getElementById("kpi-injuries-sub");
    let growthTextForFinding = "";

    if (filterState.year === "All") {
        const rows2011 = rawStateData.filter(
            (d) => d.Year === 2011 && (filterState.state === "All" || d.State === filterState.state)
        );
        const rows2021 = rawStateData.filter(
            (d) => d.Year === 2021 && (filterState.state === "All" || d.State === filterState.state)
        );
        const sum2011 = d3.sum(rows2011, (d) => d.Hospitalised_Injuries);
        const sum2021 = d3.sum(rows2021, (d) => d.Hospitalised_Injuries);
        const pct10Yr = sum2011 > 0 ? (((sum2021 - sum2011) / sum2011) * 100).toFixed(1) : "0.0";
        const arrow = pct10Yr >= 0 ? "▲ +" : "▼ ";
        const cls = pct10Yr >= 0 ? "yoy-up" : "yoy-down";
        injSub.innerHTML = `2011–2021 total (<span class="${cls}">${arrow}${pct10Yr}%</span> from 2011 to 2021)`;
        growthTextForFinding = `${pct10Yr >= 0 ? "+" : ""}${pct10Yr}% since 2011`;
    } else {
        const yrNum = Number(filterState.year);
        if (yrNum > 2011) {
            const prevRows = rawStateData.filter(
                (d) => d.Year === yrNum - 1 && (filterState.state === "All" || d.State === filterState.state)
            );
            const prevSum = d3.sum(prevRows, (d) => d.Hospitalised_Injuries);
            const yoy = prevSum > 0 ? (((totalInjuries - prevSum) / prevSum) * 100).toFixed(1) : "0.0";
            const arrow = yoy >= 0 ? "▲ +" : "▼ ";
            const cls = yoy >= 0 ? "yoy-up" : "yoy-down";
            injSub.innerHTML = `<span class="${cls}">${arrow}${yoy}%</span> vs ${yrNum - 1} (${d3.format(",")(prevSum)})`;
            growthTextForFinding = `${yoy >= 0 ? "+" : ""}${yoy}% vs ${yrNum - 1}`;
        } else {
            injSub.textContent = "Baseline reporting year (2011)";
            growthTextForFinding = "2011 baseline year";
        }
    }

    // Dynamic Key Finding banner for audiences (Tutor feedback: "Very good findings - useful for audiences")
    const findingEl = document.getElementById("state-key-finding");
    if (findingEl && stateSummary.length) {
        const topVol = [...stateSummary].sort((a, b) => d3.descending(a.Hospitalised_Injuries, b.Hospitalised_Injuries))[0];
        const topSev = [...stateSummary].sort((a, b) => d3.descending(a.Average_Bed_Days, b.Average_Bed_Days))[0];
        const natTotal = d3.sum(stateSummary, (d) => d.Hospitalised_Injuries) || 1;
        const periodLabel = filterState.year === "All" ? "2011–2021" : filterState.year;

        if (filterState.state === "All") {
            const top3Sum = [...stateSummary]
                .sort((a, b) => d3.descending(a.Hospitalised_Injuries, b.Hospitalised_Injuries))
                .slice(0, 3)
                .reduce((acc, cur) => acc + cur.Hospitalised_Injuries, 0);
            const top3Pct = ((top3Sum / natTotal) * 100).toFixed(1);

            findingEl.innerHTML =
                `<strong>Key Finding (${periodLabel}):</strong> Populous eastern states (<strong>NSW, Vic, Qld</strong>) account for <strong>${top3Pct}%</strong> of raw hospitalisations (led by <strong>${topVol.State}</strong> with ${d3.format(",")(topVol.Hospitalised_Injuries)}), whereas smaller/remote jurisdictions experience longer hospital stays—led by <strong>${topSev.State} (${topSev.Average_Bed_Days.toFixed(2)} bed days</strong> vs ${nationalAvgBedDays.toFixed(2)}d national avg), reflecting higher crash severity.`;
        } else {
            const stObj = stateSummary.find((d) => d.State === filterState.state);
            const sharePct = stObj ? ((stObj.Hospitalised_Injuries / natTotal) * 100).toFixed(1) : "0.0";
            const diffBed = stObj ? (stObj.Average_Bed_Days - nationalAvgBedDays).toFixed(2) : "0.00";
            const bedCompare = Number(diffBed) >= 0 ? `${diffBed}d above` : `${Math.abs(Number(diffBed)).toFixed(2)}d below`;

            findingEl.innerHTML =
                `<strong>${filterState.state} Insight (${periodLabel}):</strong> Recorded <strong>${d3.format(",")(totalInjuries)}</strong> hospitalised injuries (<strong>${sharePct}%</strong> of national total; ${growthTextForFinding}), with an average stay of <strong>${weightedAvgBedDays.toFixed(2)} bed days</strong> (${bedCompare} the ${nationalAvgBedDays.toFixed(2)}d national benchmark).`;
        }
    }
}

function updateDashboard() {
    if (!rawStateData.length) return;

    const periodText = filterState.year === "All" ? "2011–2021" : filterState.year;
    const stateText = filterState.state === "All" ? "All Australia" : filterState.state;
    const metricText = metricLabels[filterState.metric];

    // Header badge
    document.getElementById("active-year-label").textContent =
        filterState.state === "All" ? periodText : `${filterState.state} (${periodText})`;

    // Chart titles
    if (filterState.trendMode === "indexed") {
        document.getElementById("title-chart-1").textContent =
            `% Change in ${metricText} Since 2011`;
    } else if (filterState.trendMode === "multi") {
        document.getElementById("title-chart-1").textContent =
            `State-by-State ${metricText}, 2011–2021`;
    } else {
        document.getElementById("title-chart-1").textContent =
            `Annual ${metricText}, 2011–2021 (${stateText})`;
    }

    document.getElementById("title-chart-2").textContent =
        `${metricText} by State (${periodText})`;
    document.getElementById("title-chart-3").textContent =
        `Average Bed Days by State (${periodText})`;
    document.getElementById("title-chart-4").textContent =
        `State Injury Share Treemap (${periodText})`;

    const stateSummary = getStateSummaryForSelectedYear();
    const natTotalInjuries = d3.sum(stateSummary, (d) => d.Hospitalised_Injuries);
    const natTotalBedDays = d3.sum(stateSummary, (d) => d.Bed_Days);
    const nationalAvgBedDays = natTotalInjuries > 0 ? natTotalBedDays / natTotalInjuries : 0;

    updateKPIsAndFinding(stateSummary, nationalAvgBedDays);

    renderChart1Trend(
        rawStateData,
        filterState,
        (clickedYear) => {
            const yearSelect = document.getElementById("filter-year");
            yearSelect.value = clickedYear;
            yearSelect.dispatchEvent(new Event("change"));
        },
        (clickedState) => {
            filterState.state = clickedState;
            document.getElementById("filter-state").value = clickedState;
            updateDashboard();
        }
    );

    renderChart2StateBars(stateSummary, filterState, (clickedState) => {
        filterState.state = clickedState;
        document.getElementById("filter-state").value = clickedState;
        updateDashboard();
    });

    renderChart3BedDays(stateSummary, nationalAvgBedDays, filterState, (clickedState) => {
        filterState.state = clickedState;
        document.getElementById("filter-state").value = clickedState;
        updateDashboard();
    });

    renderChart4StateTreemap(stateSummary, filterState, (clickedState) => {
        filterState.state = clickedState;
        document.getElementById("filter-state").value = clickedState;
        updateDashboard();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    let enlargedChart = null;
    let chartFocusReturn = null;
    let timelinePlaybackTimer = null;
    let timelinePlaybackYear = 2011;
    let timelineHasStarted = false;
    const chartOverlay = document.createElement("div");
    chartOverlay.className = "chart-enlarge-overlay";
    chartOverlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(chartOverlay);
    let chartInsightObserver = null;

    const timelineControls = Array.from(document.querySelectorAll(".year-timeline")).map((container) => ({
        slider: container.querySelector('input[type="range"]'),
        output: container.querySelector("output"),
        playButton: container.querySelector(".timeline-play-btn")
    }));

    function findInteractiveMark(target, chartArea) {
        let element = target instanceof Element ? target : null;
        while (element && element !== chartArea) {
            if (element instanceof SVGElement && Array.isArray(element.__on)) return element;
            element = element.parentElement;
        }
        return null;
    }

    function clearChartSpotlight(chartArea) {
        chartArea.querySelectorAll(".chart-mark-active, .chart-mark-muted").forEach((mark) => {
            mark.classList.remove("chart-mark-active", "chart-mark-muted");
        });
    }

    function spotlightChartMark(mark, chartArea) {
        const svg = mark.closest("svg");
        if (!svg) return;

        clearChartSpotlight(chartArea);
        svg.querySelectorAll("*").forEach((candidate) => {
            if (!Array.isArray(candidate.__on)) return;
            candidate.classList.add(candidate === mark ? "chart-mark-active" : "chart-mark-muted");
        });
    }

    document.querySelectorAll(".chart-area").forEach((chartArea) => {
        chartArea.addEventListener("pointerover", (event) => {
            const mark = findInteractiveMark(event.target, chartArea);
            if (mark) spotlightChartMark(mark, chartArea);
        });

        chartArea.addEventListener("pointerout", (event) => {
            if (findInteractiveMark(event.relatedTarget, chartArea)) return;
            clearChartSpotlight(chartArea);
        });

        chartArea.addEventListener("focusin", (event) => {
            const mark = findInteractiveMark(event.target, chartArea);
            if (mark) spotlightChartMark(mark, chartArea);
        });

        chartArea.addEventListener("focusout", (event) => {
            if (findInteractiveMark(event.relatedTarget, chartArea)) return;
            clearChartSpotlight(chartArea);
        });
    });

    function syncTimelineControls() {
        const selectedYear = filterState.year === "All" ? "All years" : String(filterState.year);
        timelineControls.forEach(({ slider, output }) => {
            if (!slider || !output) return;
            slider.value = filterState.year === "All" ? "2011" : String(filterState.year);
            slider.setAttribute("aria-valuetext", selectedYear);
            output.value = selectedYear;
            output.textContent = selectedYear;
        });
    }

    function stopTimelinePlayback({ completed = false, resetProgress = false } = {}) {
        if (timelinePlaybackTimer !== null) {
            window.clearInterval(timelinePlaybackTimer);
            timelinePlaybackTimer = null;
        }
        if (completed || resetProgress) timelineHasStarted = false;
        timelineControls.forEach(({ playButton }) => {
            if (!playButton) return;
            playButton.textContent = completed ? "Replay" : timelineHasStarted ? "Resume" : "Play";
            const label = completed
                ? "Replay timeline from 2011"
                : timelineHasStarted
                    ? "Resume timeline"
                    : "Play timeline";
            playButton.setAttribute("aria-label", label);
        });
    }

    function runTimelinePlayback() {
        timelineControls.forEach(({ playButton }) => {
            if (!playButton) return;
            playButton.textContent = "Pause";
            playButton.setAttribute("aria-label", "Pause timeline");
        });
        timelinePlaybackTimer = window.setInterval(() => {
            timelinePlaybackYear += 1;
            selectTimelineYear(timelinePlaybackYear);
            if (timelinePlaybackYear >= 2021) stopTimelinePlayback({ completed: true });
        }, 1000);
    }

    function selectTimelineYear(year) {
        const yearSelect = document.getElementById("filter-year");
        yearSelect.value = String(year);
        yearSelect.dispatchEvent(new CustomEvent("change", { detail: { timelinePlayback: true } }));
    }

    function updateEnlargedChartInsight() {
        if (!enlargedChart) return;

        const area = enlargedChart.querySelector(".chart-area");
        const insight = enlargedChart.querySelector(".chart-insight");
        if (!area || !insight) return;

        const values = [];
        area.querySelectorAll("svg *").forEach((element) => {
            if (!Array.isArray(element.__on)) return;
            const bound = element.__data__;
            if (!bound || Array.isArray(bound) || typeof bound !== "object") return;

            const datum = bound.data && typeof bound.data === "object" ? bound.data : bound;
            const valueKeys = ["val", "value", "Hospitalised_Injuries", "Bed_Days", "Average_Bed_Days", "Sum(Hospitalisations)"];
            const valueKey = valueKeys.find((key) => Number.isFinite(Number(datum[key])));
            if (!valueKey) return;

            let label = datum.key ?? datum.State ?? datum.state ?? datum.Year ?? datum.year ?? datum.age;
            const className = typeof element.className === "object" ? element.className.baseVal : element.className;
            if (datum.status && datum.age !== undefined) {
                label = `${datum.status}, age ${datum.age}`;
            } else if (typeof className === "string" && className.includes("dot-FirstNationspeople")) {
                label = `First Nations, ${label}`;
            } else if (typeof className === "string" && className.includes("dot-Non-Indigenous")) {
                label = `Non-Indigenous, ${label}`;
            }

            const numericValue = Number(datum[valueKey]);
            values.push({
                label: label === undefined ? "Data point" : String(label),
                value: numericValue
            });
        });

        const uniqueValues = Array.from(
            new Map(values.map((item) => [`${item.label}:${item.value}`, item])).values()
        );
        if (!uniqueValues.length) {
            insight.textContent = "Insight Spotlight: Hover over a mark to explore its value.";
            return;
        }

        const numberFormat = new Intl.NumberFormat(undefined, {
            maximumFractionDigits: uniqueValues.some((item) => !Number.isInteger(item.value)) ? 2 : 0
        });
        const highest = uniqueValues.reduce((best, item) => item.value > best.value ? item : best);
        const lowest = uniqueValues.reduce((best, item) => item.value < best.value ? item : best);
        const summary = [`Highest: ${highest.label} (${numberFormat.format(highest.value)})`];
        if (uniqueValues.length > 1) {
            summary.push(`Lowest: ${lowest.label} (${numberFormat.format(lowest.value)})`);
            summary.push(`Spread: ${numberFormat.format(highest.value - lowest.value)}`);
        }
        insight.textContent = `Insight Spotlight: ${summary.join(" · ")}`;
    }

    document.addEventListener("mousemove", (event) => {
        const tooltip = document.getElementById("tooltip");
        if (!tooltip || tooltip.classList.contains("hidden")) return;

        const padding = 12;
        const tooltipRect = tooltip.getBoundingClientRect();
        const left = Math.min(event.clientX + padding, window.innerWidth - tooltipRect.width - padding);
        const top = Math.min(event.clientY - 28, window.innerHeight - tooltipRect.height - padding);
        tooltip.style.left = `${Math.max(padding, left)}px`;
        tooltip.style.top = `${Math.max(padding, top)}px`;
    });

    function closeEnlargedChart(restoreFocus = true) {
        if (!enlargedChart) return;

        const chart = enlargedChart;
        enlargedChart = null;
        chart.classList.remove("chart-box-enlarged");
        chart.removeAttribute("role");
        chart.removeAttribute("aria-modal");
        chart.removeAttribute("aria-label");
        if (chartInsightObserver) {
            chartInsightObserver.disconnect();
            chartInsightObserver = null;
        }
        const insight = chart.querySelector(".chart-insight");
        if (insight) insight.remove();
        const button = chart.querySelector(".chart-enlarge-btn");
        const heading = chart.querySelector(".chart-header h2");
        if (button && heading) {
            button.textContent = "Enlarge";
            button.setAttribute("aria-label", `Enlarge chart: ${heading.textContent.trim()}`);
        }
        chartOverlay.classList.remove("active");
        chartOverlay.setAttribute("aria-hidden", "true");
        window.dispatchEvent(new Event("resize"));
        if (restoreFocus && chartFocusReturn && chart.contains(chartFocusReturn)) chartFocusReturn.focus();
        chartFocusReturn = null;
    }

    document.querySelectorAll(".chart-box").forEach((chart) => {
        const heading = chart.querySelector(".chart-header h2");
        const header = chart.querySelector(".chart-header");
        if (!header || !heading) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "chart-enlarge-btn";
        button.textContent = "Enlarge";
        button.setAttribute("aria-label", `Enlarge chart: ${heading.textContent.trim()}`);
        header.appendChild(button);

        button.addEventListener("click", () => {
            if (enlargedChart === chart) {
                closeEnlargedChart();
                return;
            }
            if (enlargedChart) closeEnlargedChart();

            enlargedChart = chart;
            chartFocusReturn = button;
            chart.classList.add("chart-box-enlarged");
            chart.setAttribute("role", "dialog");
            chart.setAttribute("aria-modal", "true");
            chart.setAttribute("aria-label", heading.textContent.trim());
            chartOverlay.classList.add("active");
            chartOverlay.setAttribute("aria-hidden", "false");
            button.textContent = "Close";
            button.setAttribute("aria-label", `Close enlarged chart: ${heading.textContent.trim()}`);
            const insight = document.createElement("p");
            insight.className = "chart-insight";
            insight.setAttribute("role", "status");
            insight.setAttribute("aria-live", "polite");
            const chartArea = chart.querySelector(".chart-area");
            if (chartArea) chart.insertBefore(insight, chartArea);
            window.dispatchEvent(new Event("resize"));
            updateEnlargedChartInsight();
            if (chartArea) {
                chartInsightObserver = new MutationObserver(updateEnlargedChartInsight);
                chartInsightObserver.observe(chartArea, { childList: true, subtree: true });
            }
            button.focus();
        });
    });

    chartOverlay.addEventListener("click", closeEnlargedChart);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeEnlargedChart();
    });

    // Tab switching
    function updateFilterBarVisibility(activeTab) {
        const stateField = document.getElementById("field-state");
        const roadUserField = document.getElementById("field-road-user");
        const metricField = document.getElementById("field-metric");
        if (!stateField || !roadUserField || !metricField) return;

        if (activeTab === "demographics") {
            stateField.style.display = "none";
            roadUserField.style.display = "flex";
            metricField.style.display = "flex";
        } else if (activeTab === "first-nations") {
            stateField.style.display = "none";
            roadUserField.style.display = "none";
            metricField.style.display = "none";
        } else {
            // Overview (State & National Trends)
            stateField.style.display = "flex";
            roadUserField.style.display = "none";
            metricField.style.display = "flex";
        }
    }

    document.querySelectorAll("button.tab-btn[data-view]").forEach((tab) => {
        tab.addEventListener("click", () => {
            if (tab.dataset.view !== "overview") stopTimelinePlayback();
            closeEnlargedChart(false);
            document.querySelectorAll(".tab-btn").forEach((t) => t.classList.remove("active"));
            document.querySelectorAll(".view-section").forEach((s) => s.classList.remove("active"));

            tab.classList.add("active");
            const target = document.getElementById(`view-${tab.dataset.view}`);
            if (target) target.classList.add("active");

            updateFilterBarVisibility(tab.dataset.view);
        });
    });

    // Global dropdown listeners (< 5 selections)
    document.getElementById("filter-year").addEventListener("change", (e) => {
        if (!e.detail || !e.detail.timelinePlayback) stopTimelinePlayback({ resetProgress: true });
        filterState.year = e.target.value;
        syncTimelineControls();
        updateDashboard();
    });

    timelineControls.forEach(({ slider, playButton }) => {
        if (slider) {
            slider.addEventListener("input", () => {
                stopTimelinePlayback({ resetProgress: true });
                selectTimelineYear(slider.value);
            });
        }

        if (playButton) {
            playButton.addEventListener("click", () => {
                if (timelinePlaybackTimer !== null) {
                    stopTimelinePlayback();
                    return;
                }

                if (!timelineHasStarted) {
                    timelinePlaybackYear = 2011;
                    timelineHasStarted = true;
                    selectTimelineYear(timelinePlaybackYear);
                }
                runTimelinePlayback();
            });
        }
    });

    document.getElementById("filter-state").addEventListener("change", (e) => {
        filterState.state = e.target.value;
        updateDashboard();
    });

    document.getElementById("filter-metric").addEventListener("change", (e) => {
        filterState.metric = e.target.value;
        updateDashboard();
    });

    // Chart-level controls
    document.getElementById("filter-trend-mode").addEventListener("change", (e) => {
        filterState.trendMode = e.target.value;
        updateDashboard();
    });

    document.getElementById("filter-sort").addEventListener("change", (e) => {
        filterState.sort = e.target.value;
        updateDashboard();
    });

    document.querySelectorAll("#toggle-bar-mode .mini-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#toggle-bar-mode .mini-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            filterState.barMode = btn.dataset.barmode;
            updateDashboard();
        });
    });

    // Reset button
    document.getElementById("btn-reset-filters").addEventListener("click", () => {
        stopTimelinePlayback({ resetProgress: true });
        filterState.year = "All";
        filterState.state = "All";
        filterState.metric = "Hospitalised_Injuries";
        filterState.trendMode = "single";
        filterState.barMode = "raw";
        filterState.sort = "value-desc";

        document.getElementById("filter-year").value = "All";
        syncTimelineControls();
        document.getElementById("filter-state").value = "All";
        document.getElementById("filter-metric").value = "Hospitalised_Injuries";
        document.getElementById("filter-trend-mode").value = "single";
        document.getElementById("filter-sort").value = "value-desc";
        const ruSelect = document.getElementById("filter-road-user");
        if (ruSelect) ruSelect.value = "All";

        document.querySelectorAll("#toggle-bar-mode .mini-btn").forEach((b) => {
            b.classList.toggle("active", b.dataset.barmode === "raw");
        });

        updateDashboard();
    });

    // Load state_by_year.csv
    d3.csv("data/state_by_year.csv", d3.autoType)
        .then((data) => {
            rawStateData = data;
            updateDashboard();
        })
        .catch((err) => {
            console.warn("Could not fetch data/state_by_year.csv via file://. Open with Live Server.", err);
        });

    window.addEventListener("resize", () => updateDashboard());
});
