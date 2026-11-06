let rawFnData = [];
const fnSelection = {
    category: null, // "Remoteness" | "Age" | "Road User"
    value: null     // clicked sub-category value
};

function initFirstNationsCharts() {
    if (!rawFnData.length) return;

    const yearEl = document.getElementById("filter-year");
    const yearVal = yearEl ? yearEl.value : "All";

    const filtered = yearVal === "All"
        ? rawFnData
        : rawFnData.filter(d => String(d["Calendar year"]) === String(yearVal));

    updateFnKeyFinding(filtered, yearVal);
    renderFnTrendChart(filtered, yearVal);
    renderFnRemotenessChart(filtered);
    renderFnAgeChart(filtered);
    renderFnRoadUserChart(filtered);
}

function updateFnKeyFinding(data, yearVal) {
    const findingBar = document.getElementById("fn-key-finding");
    if (!findingBar) return;

    const periodText = yearVal === "All" ? "2011–2021" : yearVal;
    
    if (fnSelection.value) {
        findingBar.innerHTML = `<strong>First Nations Filter (${fnSelection.category}):</strong> Showing data filtered for <strong>${fnSelection.value}</strong> (${periodText}).` +
            ` &nbsp; <button type="button" class="mini-btn" id="btn-clear-fn-sel">Clear selection</button>`;
        const clearBtn = document.getElementById("btn-clear-fn-sel");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                fnSelection.category = null;
                fnSelection.value = null;
                initFirstNationsCharts();
            });
        }
        return;
    }

    const fnRows = data.filter(d => d["First Nations status"] === "First Nations people");
    const fnTotal = d3.sum(fnRows, d => d["Sum(Hospitalisations)"] || 0);

    findingBar.innerHTML = `<strong>First Nations Insights (${periodText}):</strong> Recorded <strong>${d3.format(",")(fnTotal)}</strong> First Nations hospitalisations. ` +
        `<em>Tip: Click any bar or slice to highlight and focus on a specific group.</em>`;
}

// 1. Annual Trend Line Chart
function renderFnTrendChart(data, yearVal) {
    const container = d3.select("#fn-chart-trend");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const margin = { top: 18, right: 30, bottom: 28, left: 58 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Use rawFnData so the trend line preserves full historical context across 2011–2021
    let activeData = rawFnData.filter(d => d.Category === "Age");
    if (fnSelection.value) {
        activeData = rawFnData.filter(d => d.Category === fnSelection.category && d.Sub_Category === fnSelection.value);
    }

    const years = Array.from(new Set(activeData.map(d => d["Calendar year"]))).sort(d3.ascending);
    const statuses = ["First Nations people", "Non-Indigenous"];

    const series = statuses.map(st => {
        const rows = activeData.filter(d => d["First Nations status"] === st);
        const yrMap = d3.rollup(rows, v => d3.sum(v, d => d["Sum(Hospitalisations)"]), d => d["Calendar year"]);
        return {
            status: st,
            values: years.map(yr => ({ year: yr, val: yrMap.get(yr) || 0 }))
        };
    });

    const maxVal = d3.max(series, s => d3.max(s.values, d => d.val)) || 1;

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-trend-title fn-trend-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-trend-title").text("First Nations vs Non-Indigenous Annual Trend");
    svg.append("desc").attr("id", "fn-trend-desc").text("Line chart comparing annual hospitalised injuries between First Nations people and Non-Indigenous Australians from 2011 to 2021.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint().domain(years).range([0, innerWidth]).padding(0.25);
    const y = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([innerHeight, 0]);

    // Gridlines
    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3"));

    // X-Axis
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .call(g => g.select(".domain").attr("stroke", "#cbd5e1"))
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#4b5563")
        .style("font-weight", d => String(d) === String(yearVal) ? "700" : "400");

    // Y-Axis
    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").remove())
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#4b5563");

    const colorScale = {
        "First Nations people": "#D55E00",
        "Non-Indigenous": "#0072B2"
    };

    const line = d3.line().x(d => x(d.year)).y(d => y(d.val));
    const tooltip = d3.select("#tooltip");

    const selectedYear = yearVal === "All" ? null : Number(yearVal);
    if (selectedYear !== null && x(selectedYear) !== undefined) {
        const previousYear = renderFnTrendChart.previousYear ?? years[0];
        const marker = g.append("line")
            .attr("class", "trend-year-marker")
            .attr("x1", x(previousYear))
            .attr("x2", x(previousYear))
            .attr("y1", 0)
            .attr("y2", innerHeight)
            .attr("stroke", "#334155")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "4,3")
            .attr("opacity", 0.75);
        chartTransition(marker, 650)
            .attr("x1", x(selectedYear))
            .attr("x2", x(selectedYear));
        renderFnTrendChart.previousYear = selectedYear;
    } else if (selectedYear === null) {
        renderFnTrendChart.previousYear = years[0];
    }

    series.forEach(s => {
        const seriesPath = g.append("path")
            .datum(s.values)
            .attr("fill", "none")
            .attr("stroke", colorScale[s.status])
            .attr("stroke-width", 2.6)
            .attr("opacity", 0.85)
            .attr("d", line);

        const pathLength = seriesPath.node().getTotalLength();
        seriesPath
            .attr("stroke-dasharray", `${pathLength} ${pathLength}`)
            .attr("stroke-dashoffset", pathLength);
        chartTransition(seriesPath, 750)
            .attr("stroke-dashoffset", 0)
            .on("end", function() {
                d3.select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
            });

        const dots = g.selectAll(`.dot-${s.status.replace(/\s+/g, '')}`)
            .data(s.values)
            .join("circle")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.val))
            .attr("r", 0)
            .attr("fill", colorScale[s.status])
            .attr("stroke", d => String(d.year) === String(yearVal) ? "#111827" : "#ffffff")
            .attr("stroke-width", d => String(d.year) === String(yearVal) ? 2.5 : 2)
            .style("cursor", "pointer")
            .on("mouseenter", (event, d) => {
                tooltip.classed("hidden", false)
                    .html(`<strong>${s.status} (${d.year})</strong><br/>Hospitalisations: <strong>${d3.format(",")(d.val)}</strong>`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
            })
            .on("mouseleave", () => tooltip.classed("hidden", true));
        dots.each(function(d, index) {
            chartTransition(d3.select(this), 400)
                .delay(index * 16)
                .attr("r", String(d.year) === String(yearVal) ? 7 : 4.5);
        });
    });

    const legend = svg.append("g").attr("transform", `translate(${margin.left + 10}, ${margin.top + 2})`);
    statuses.forEach((st, i) => {
        const lg = legend.append("g").attr("transform", `translate(${i * 130}, 0)`);
        lg.append("rect").attr("width", 10).attr("height", 10).attr("fill", colorScale[st]).attr("rx", 2);
        lg.append("text").attr("x", 14).attr("y", 9).style("font-size", "10.5px").style("fill", "#374151").text(st);
    });
}

// 2. Remoteness Donut Chart
function renderFnRemotenessChart(data) {
    const container = d3.select("#fn-chart-remoteness");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;

    const remData = data.filter(d => d.Category === "Remoteness" && d["First Nations status"] === "First Nations people");
    const summaryMap = d3.rollup(remData, v => d3.sum(v, d => d["Sum(Hospitalisations)"] || 0), d => d.Sub_Category);
    const summary = Array.from(summaryMap, ([key, val]) => ({ key, val }))
        .sort((a, b) => d3.descending(a.val, b.val));

    const total = d3.sum(summary, d => d.val) || 1;

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-rem-title fn-rem-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-rem-title").text("First Nations Share by Remoteness Area");
    svg.append("desc").attr("id", "fn-rem-desc").text("Donut chart showing First Nations hospitalisations across remoteness areas.");

    const radius = Math.min(width * 0.42, height) / 2 - 12;
    const centerX = width * 0.28;
    const centerY = height / 2;

    const g = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);

    const color = d3.scaleOrdinal()
        .domain(summary.map(d => d.key))
        .range(["#D55E00", "#0072B2", "#009E73"]);

    const pie = d3.pie().value(d => d.val).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.54).outerRadius(radius);
    const tooltip = d3.select("#tooltip");

    const isRemSelected = fnSelection.category === "Remoteness";

    const slices = g.selectAll("path")
        .data(pie(summary))
        .join("path")
        .each(function(d) {
            this._current = { ...d, endAngle: d.startAngle };
        })
        .attr("d", d => arc({ ...d, endAngle: d.startAngle }))
        .attr("fill", d => color(d.data.key))
        .attr("stroke", d => (isRemSelected && fnSelection.value === d.data.key) ? "#111827" : "#ffffff")
        .attr("stroke-width", d => (isRemSelected && fnSelection.value === d.data.key) ? 3 : 2.2)
        .attr("opacity", d => (!isRemSelected || fnSelection.value === d.data.key) ? 1 : 0.25)
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            const pct = ((d.data.val / total) * 100).toFixed(1);
            tooltip.classed("hidden", false)
                .html(`<strong>${d.data.key} (First Nations)</strong><br/>Injuries: <strong>${d3.format(",")(d.data.val)}</strong> (${pct}%)`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("click", (event, d) => {
            if (fnSelection.category === "Remoteness" && fnSelection.value === d.data.key) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Remoteness";
                fnSelection.value = d.data.key;
            }
            initFirstNationsCharts();
        });
    chartTransition(slices, 700).attrTween("d", function(d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(1);
        return t => arc(interpolate(t));
    });

    g.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em").style("font-size", "11px").style("fill", "#4b5563").text("Total");
    g.append("text").attr("text-anchor", "middle").attr("dy", "1.1em").style("font-size", "14.5px").style("font-weight", "700").style("fill", "#111827").text(d3.format(",")(total));

    const rowSpacing = Math.min(22, (height - 20) / Math.max(summary.length, 1));
    const startY = (height - (summary.length - 1) * rowSpacing) / 2;
    const legend = svg.append("g").attr("transform", `translate(${width * 0.54}, ${startY})`);

    const rows = legend.selectAll(".legend-item")
        .data(summary)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * rowSpacing})`)
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            if (fnSelection.category === "Remoteness" && fnSelection.value === d.key) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Remoteness";
                fnSelection.value = d.key;
            }
            initFirstNationsCharts();
        });

    rows.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("y", -10).attr("fill", d => color(d.key));
    rows.append("text").attr("x", 18).attr("y", 0).style("font-size", "12px").style("font-weight", "700").style("fill", "#1f2937").text(d => d.key);
    rows.append("text").attr("x", 185).attr("y", 0).attr("text-anchor", "end").style("font-size", "11.5px").style("font-weight", "600").style("fill", "#374151").text(d => `${d3.format(",")(d.val)} (${((d.val / total) * 100).toFixed(1)}%)`);
    chartTransition(rows, 500)
        .delay((d, index) => index * 45)
        .attr("opacity", d => (!isRemSelected || fnSelection.value === d.key) ? 1 : 0.35);
}

// 3. Butterfly chart compares each population's age distribution.
function renderFnAgeChart(data) {
    const container = d3.select("#fn-chart-age");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const margin = { top: 36, right: 14, bottom: 22, left: 14 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const ageData = data.filter(d => d.Category === "Age");
    const ageGroups = ["0-7", "8-16", "17-25", "26-39", "40-64", "65+"];
    const statuses = ["First Nations people", "Non-Indigenous"];

    // Normalize within each population so the age distributions can be compared fairly.
    const summary = ageGroups.map(grp => {
        const fnVal = d3.sum(
            ageData.filter(d => d.Sub_Category === grp && d["First Nations status"] === "First Nations people"),
            d => d["Sum(Hospitalisations)"] || 0
        );
        const nonVal = d3.sum(
            ageData.filter(d => d.Sub_Category === grp && d["First Nations status"] === "Non-Indigenous"),
            d => d["Sum(Hospitalisations)"] || 0
        );
        return {
            age: grp,
            "First Nations people": fnVal,
            "Non-Indigenous": nonVal
        };
    });
    const fnTotal = d3.sum(summary, d => d["First Nations people"]) || 0;
    const nonTotal = d3.sum(summary, d => d["Non-Indigenous"]) || 0;
    const maxShare = d3.max(summary, d => Math.max(
        fnTotal ? d["First Nations people"] / fnTotal * 100 : 0,
        nonTotal ? d["Non-Indigenous"] / nonTotal * 100 : 0
    )) || 1;
    const centerX = innerWidth / 2;
    const centerGap = Math.min(74, innerWidth * 0.18);
    const sideWidth = Math.max(0, (innerWidth - centerGap) / 2);
    const fnScale = d3.scaleLinear().domain([0, maxShare]).range([0, sideWidth]);
    const nonScale = d3.scaleLinear().domain([0, maxShare]).range([0, sideWidth]);
    const y = d3.scaleBand().domain(ageGroups).range([0, innerHeight]).padding(0.24);

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-age-title fn-age-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-age-title").text("Hospitalisation share by age group: butterfly comparison");
    svg.append("desc").attr("id", "fn-age-desc").text("Butterfly chart comparing each population's percentage distribution of hospitalisations across age groups. The scales show share within each population, while tooltips include the corresponding case count. Activate a bar to filter to that age group.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const colorScale = {
        "First Nations people": "#D55E00",
        "Non-Indigenous": "#0072B2"
    };

    svg.append("text")
        .attr("x", margin.left + centerX - centerGap / 2 - sideWidth / 2)
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("class", "butterfly-series-label")
        .attr("fill", "#9a3412")
        .attr("font-size", 10)
        .attr("font-weight", 700)
        .text("First Nations · share");
    svg.append("text")
        .attr("x", margin.left + centerX + centerGap / 2 + sideWidth / 2)
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("class", "butterfly-series-label")
        .attr("fill", "#075985")
        .attr("font-size", 10)
        .attr("font-weight", 700)
        .text("Non-Indigenous · share");

    [0, maxShare / 2, maxShare].forEach(value => {
        const offset = fnScale(value);
        [centerX - centerGap / 2 - offset, centerX + centerGap / 2 + offset].forEach(xPos => {
            g.append("line")
                .attr("x1", xPos)
                .attr("x2", xPos)
                .attr("y1", 0)
                .attr("y2", innerHeight)
                .attr("stroke", "#e5e7eb")
                .attr("stroke-dasharray", value === 0 ? null : "3,3");
        });
    });

    summary.forEach(d => {
        g.append("text")
            .attr("x", centerX)
            .attr("y", y(d.age) + y.bandwidth() / 2 + 4)
            .attr("text-anchor", "middle")
            .attr("class", "butterfly-age-label")
            .attr("fill", "#1f2937")
            .attr("font-size", 10)
            .attr("font-weight", 700)
            .text(d.age);
    });

    const tooltip = d3.select("#tooltip");
    const isAgeSelected = fnSelection.category === "Age";

    const barData = summary.flatMap(d => statuses.map(status => ({
        age: d.age,
        status,
        count: d[status],
        share: (d[status] / (status === "First Nations people" ? fnTotal : nonTotal)) * 100 || 0
    })));

    g.selectAll(".butterfly-bar")
        .data(barData)
        .join("rect")
        .attr("class", "butterfly-bar")
        .attr("x", d => d.status === "First Nations people"
            ? centerX - centerGap / 2
            : centerX + centerGap / 2)
        .attr("y", d => y(d.age) + y.bandwidth() * 0.12)
        .attr("width", 0)
        .attr("height", y.bandwidth() * 0.76)
        .attr("rx", 3)
        .attr("fill", d => colorScale[d.status])
        .attr("stroke", d => (isAgeSelected && fnSelection.value === d.age) ? "#111827" : "none")
        .attr("stroke-width", 2)
        .attr("opacity", d => (!isAgeSelected || fnSelection.value === d.age) ? 1 : 0.45)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", d => `Age ${d.age}, ${d.status}: ${d.share.toFixed(1)}% of that population's hospitalisations, ${d3.format(",")(d.count)} cases. Activate to filter to age ${d.age}.`)
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            tooltip.classed("hidden", false)
                .html(`<strong>Age ${d.age} — ${d.status}</strong><br/>Share of this population: <strong>${d.share.toFixed(1)}%</strong><br/>Hospitalisations: <strong>${d3.format(",")(d.count)}</strong>`);
        })
        .on("mousemove", event => {
            tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("click", (event, d) => {
            if (fnSelection.category === "Age" && fnSelection.value === d.age) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Age";
                fnSelection.value = d.age;
            }
            initFirstNationsCharts();
        })
        .on("keydown", function(event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            }
        });

    chartTransition(g.selectAll(".butterfly-bar"), 700)
        .attr("x", d => d.status === "First Nations people"
            ? centerX - centerGap / 2 - fnScale(d.share)
            : centerX + centerGap / 2)
        .attr("width", d => d.status === "First Nations people" ? fnScale(d.share) : nonScale(d.share));

    const shareLabels = g.selectAll(".butterfly-share-label")
        .data(barData)
        .join("text")
        .attr("class", "butterfly-share-label")
        .attr("x", d => d.status === "First Nations people"
            ? centerX - centerGap / 2 - fnScale(d.share) - 4
            : centerX + centerGap / 2 + nonScale(d.share) + 4)
        .attr("y", d => y(d.age) + y.bandwidth() / 2 + 3)
        .attr("text-anchor", d => d.status === "First Nations people" ? "end" : "start")
        .attr("fill", "#374151")
        .attr("font-size", 9)
        .attr("font-weight", 600)
        .attr("pointer-events", "none")
        .attr("opacity", 0)
        .text(d => `${d.share.toFixed(1)}%`);
    chartTransition(shareLabels, 450).delay(300).attr("opacity", 1);
}

// 4. Road User Horizontal Bar Chart (with multi-year d3.sum aggregation, wide margin & click-to-highlight)
function renderFnRoadUserChart(data) {
    const container = d3.select("#fn-chart-roaduser");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const margin = { top: 18, right: 30, bottom: 28, left: 230 }; // Wide margin for labels
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const ruData = data.filter(d => d.Category === "Road User");
    const roadUsers = Array.from(new Set(ruData.map(d => d.Sub_Category)));

    // Aggregates across all years in active view using d3.sum
    const summary = roadUsers.map(ru => {
        const totalVal = d3.sum(
            ruData.filter(d => d.Sub_Category === ru && d["First Nations status"] === "First Nations people"),
            d => d["Sum(Hospitalisations)"] || 0
        );
        return {
            roadUser: ru,
            val: totalVal
        };
    }).sort((a, b) => d3.descending(a.val, b.val));

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-ru-title fn-ru-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-ru-title").text("First Nations Injuries by Road User Type");
    svg.append("desc").attr("id", "fn-ru-desc").text("Horizontal bar chart showing road crash injuries by road user type.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().domain(summary.map(d => d.roadUser)).range([0, innerHeight]).padding(0.25);
    const x = d3.scaleLinear().domain([0, (d3.max(summary, d => d.val) || 1) * 1.15]).nice().range([0, innerWidth]);

    g.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .call(g => g.select(".domain").remove())
        .selectAll("text")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .style("fill", "#1f2937");

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-innerHeight))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3"))
        .selectAll("text")
        .style("font-size", "10px")
        .style("fill", "#4b5563");

    const tooltip = d3.select("#tooltip");
    const isRuSelected = fnSelection.category === "Road User";

    const roadUserBars = g.selectAll(".fn-ru-bar")
        .data(summary)
        .join("rect")
        .attr("class", "fn-ru-bar")
        .attr("y", d => y(d.roadUser))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", 0)
        .attr("rx", 3)
        .attr("fill", "#009E73")
        .attr("stroke", d => (isRuSelected && fnSelection.value === d.roadUser) ? "#111827" : "none")
        .attr("stroke-width", 2)
        .attr("opacity", d => (!isRuSelected || fnSelection.value === d.roadUser) ? 1 : 0.25)
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            tooltip.classed("hidden", false)
                .html(`<strong>${d.roadUser}</strong><br/>First Nations Hospitalisations: <strong>${d3.format(",")(d.val)}</strong>`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("click", (event, d) => {
            if (fnSelection.category === "Road User" && fnSelection.value === d.roadUser) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Road User";
                fnSelection.value = d.roadUser;
            }
            initFirstNationsCharts();
        });
    chartTransition(roadUserBars, 650)
        .delay((d, index) => index * 24)
        .attr("width", d => x(d.val));
}

document.addEventListener("DOMContentLoaded", () => {
    d3.csv("First_Nations_Combined.csv", d3.autoType)
        .then(data => {
            rawFnData = data;
            initFirstNationsCharts();
        })
        .catch(() => {
            d3.csv("first_nations_combined.csv", d3.autoType)
                .then(data => {
                    rawFnData = data;
                    initFirstNationsCharts();
                })
                .catch(err => {
                    d3.csv("data/First_Nations_Combined.csv", d3.autoType)
                        .then(data => {
                            rawFnData = data;
                            initFirstNationsCharts();
                        })
                        .catch(err2 => {
                            d3.csv("data/first_nations_combined.csv", d3.autoType)
                                .then(data => {
                                    rawFnData = data;
                                    initFirstNationsCharts();
                                })
                                .catch(err3 => console.warn("Could not load First Nations dataset", err3));
                        });
                });
        });

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => setTimeout(initFirstNationsCharts, 50));
    });

    const yearSelect = document.getElementById("filter-year");
    const resetBtn = document.getElementById("btn-reset-filters");

    if (yearSelect) yearSelect.addEventListener("change", initFirstNationsCharts);
    if (resetBtn) resetBtn.addEventListener("click", () => {
        fnSelection.category = null;
        fnSelection.value = null;
        setTimeout(initFirstNationsCharts, 50);
    });

    window.addEventListener("resize", initFirstNationsCharts);
});