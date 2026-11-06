function renderChart3BedDays(stateSummary, nationalAvgBedDays, filterState, onSelectState) {
    const container = d3.select("#chart-3");
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const margin = { top: 20, right: 62, bottom: 26, left: 48 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const sorted = [...stateSummary].sort((a, b) =>
        d3.descending(a.Average_Bed_Days, b.Average_Bed_Days)
    );

    const svg = container
        .append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "chart3-svg-title chart3-svg-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");
    svg.append("title").attr("id", "chart3-svg-title").text("Average Bed Days by State");
    svg.append("desc").attr("id", "chart3-svg-desc").text("Horizontal bar chart comparing average hospital bed days per road crash injury across Australian states, with a dashed vertical benchmark line showing the national average. Click a bar to filter to that state.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3
        .scaleBand()
        .domain(sorted.map((d) => d.State))
        .range([0, innerHeight])
        .padding(0.26);

    const x = d3
        .scaleLinear()
        .domain([0, (d3.max(sorted, (d) => d.Average_Bed_Days) || 1) * 1.15])
        .nice()
        .range([0, innerWidth]);

    // X Axis
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight))
        .call((g) => g.select(".domain").remove())
        .call((g) => g.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3"))
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#4b5563");

    // Y Axis
    g.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .call((g) => g.select(".domain").remove())
        .selectAll("text")
        .style("font-size", "11.5px")
        .style("font-weight", "700")
        .style("fill", "#1f2937");

    const tooltip = d3.select("#tooltip");

    // Bars: High-contrast Strong Blue (#0072B2) for above national avg, muted slate (#8C96A6) for below
    const bedBars = g.selectAll(".bed-bar")
        .data(sorted)
        .join("rect")
        .attr("class", "bed-bar")
        .attr("y", (d) => y(d.State))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", 0)
        .attr("rx", 3)
        .attr("fill", (d) =>
            d.Average_Bed_Days >= nationalAvgBedDays ? UI_COLORS.aboveAvgBar : UI_COLORS.belowAvgBar
        )
        .attr("stroke", (d) => (filterState.state === d.State ? "#111827" : "none"))
        .attr("stroke-width", 2)
        .attr("opacity", (d) =>
            filterState.state === "All" || filterState.state === d.State ? 1 : 0.28
        )
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", (d) => {
            const status = d.Average_Bed_Days >= nationalAvgBedDays ? "above" : "below";
            return `${d.State}: ${d.Average_Bed_Days.toFixed(2)} average bed days, ${status} national average of ${nationalAvgBedDays.toFixed(2)}. Click to filter to ${d.State}.`;
        })
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            const statusText =
                d.Average_Bed_Days >= nationalAvgBedDays ? "Above national avg" : "Below national avg";
            tooltip
                .classed("hidden", false)
                .html(
                    `<strong>${d.State}</strong> (${statusText})<br/>` +
                    `Avg Bed Days: <strong>${d.Average_Bed_Days.toFixed(2)} days</strong><br/>` +
                    `National Avg: <strong>${nationalAvgBedDays.toFixed(2)} days</strong>`
                );
        })
        .on("mousemove", (event) => {
            tooltip
                .style("left", `${event.pageX + 12}px`)
                .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("click", (event, d) => {
            if (onSelectState) {
                const nextState = filterState.state === d.State ? "All" : d.State;
                onSelectState(nextState);
            }
        })
        .on("keydown", (event, d) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (onSelectState) {
                    const nextState = filterState.state === d.State ? "All" : d.State;
                    onSelectState(nextState);
                }
            }
        });
    chartTransition(bedBars)
        .attr("width", (d) => x(d.Average_Bed_Days));

    // Direct Value Labels
    const bedLabels = g.selectAll(".bed-label")
        .data(sorted)
        .join("text")
        .attr("class", "bed-label")
        .attr("x", (d) => x(d.Average_Bed_Days) + 6)
        .attr("y", (d) => y(d.State) + y.bandwidth() / 2 + 4)
        .text((d) => `${d.Average_Bed_Days.toFixed(2)}d`)
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("fill", "#1f2937")
        .style("opacity", 0);
    chartTransition(bedLabels, 500).delay(180).style("opacity", 1);

    // High-contrast Dark Charcoal Benchmark Line + Direct Label (Colourblind-safe)
    if (nationalAvgBedDays > 0) {
        const benchmark = g.append("line")
            .attr("x1", x(nationalAvgBedDays))
            .attr("x2", x(nationalAvgBedDays))
            .attr("y1", -4)
            .attr("y2", innerHeight)
            .attr("stroke", UI_COLORS.benchmarkLine)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,3")
            .attr("opacity", 0);
        chartTransition(benchmark, 500).style("opacity", 1);

        const benchmarkLabel = g.append("text")
            .attr("x", x(nationalAvgBedDays))
            .attr("y", -7)
            .attr("text-anchor", "middle")
            .style("font-size", "10.5px")
            .style("font-weight", "700")
            .style("fill", "#111827")
            .style("opacity", 0)
            .text(`Avg: ${nationalAvgBedDays.toFixed(2)}d`);
        chartTransition(benchmarkLabel, 500).delay(200).style("opacity", 1);
    }
}

function renderChart4StateTreemap(stateSummary, filterState, onSelectState) {
    const container = d3.select("#chart-4");
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const sorted = [...stateSummary].sort((a, b) =>
        d3.descending(a.Hospitalised_Injuries, b.Hospitalised_Injuries)
    );
    const totalInjuries = d3.sum(sorted, (d) => d.Hospitalised_Injuries) || 0;

    const svg = container
        .append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "chart4-svg-title chart4-svg-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");
    svg.append("title").attr("id", "chart4-svg-title").text("State Share of Hospitalised Injuries");
    svg.append("desc").attr("id", "chart4-svg-desc").text("Treemap showing each Australian state and territory's share of hospitalised road crash injuries. Tile area represents injury count. Focus or hover for details; activate a tile to filter all charts to that state.");

    const tooltip = d3.select("#tooltip");
    const root = d3.hierarchy({ children: sorted })
        .sum((d) => d.Hospitalised_Injuries || 0)
        .sort((a, b) => b.value - a.value);
    d3.treemap()
        .size([width, height])
        .paddingInner(3)
        .round(true)(root);

    const cells = svg.selectAll(".state-treemap-cell")
        .data(root.leaves())
        .join("g")
        .attr("class", "state-treemap-cell")
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    cells.append("rect")
        .attr("class", "state-treemap-tile")
        .attr("x", (d) => Math.max(0, d.x1 - d.x0) / 2)
        .attr("y", (d) => Math.max(0, d.y1 - d.y0) / 2)
        .attr("width", 0)
        .attr("height", 0)
        .attr("opacity", 0)
        .attr("rx", 4)
        .attr("fill", (d) => STATE_PALETTE[d.data.State] || UI_COLORS.primaryLine)
        .attr("stroke", (d) => filterState.state === d.data.State ? "#111827" : "#ffffff")
        .attr("stroke-width", (d) => filterState.state === d.data.State ? 3 : 1.5)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", (d) => {
            const pct = totalInjuries > 0 ? ((d.data.Hospitalised_Injuries / totalInjuries) * 100).toFixed(1) : "0.0";
            return `${d.data.State}: ${d3.format(",")(d.data.Hospitalised_Injuries)} injuries, ${pct}% of total. Activate to filter to ${d.data.State}.`;
        })
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            const pct = totalInjuries > 0 ? ((d.data.Hospitalised_Injuries / totalInjuries) * 100).toFixed(1) : "0.0";
            tooltip
                .classed("hidden", false)
                .html(`<strong>${d.data.State}</strong><br/>Injuries: <strong>${d3.format(",")(d.data.Hospitalised_Injuries)}</strong><br/>National share: <strong>${pct}%</strong>`);
        })
        .on("mousemove", (event) => {
            tooltip
                .style("left", `${event.pageX + 12}px`)
                .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("click", (event, d) => {
            if (onSelectState) {
                onSelectState(filterState.state === d.data.State ? "All" : d.data.State);
            }
        })
        .on("keydown", (event, d) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (onSelectState) {
                    onSelectState(filterState.state === d.data.State ? "All" : d.data.State);
                }
            }
        });

    cells.select("rect").each(function(d, index) {
        chartTransition(d3.select(this), 650)
            .delay(index * 28)
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", Math.max(0, d.x1 - d.x0))
            .attr("height", Math.max(0, d.y1 - d.y0))
            .attr("opacity", filterState.state === "All" || filterState.state === d.data.State ? 1 : 0.3);
    });

    const treemapLabels = cells.append("text")
        .attr("class", "state-treemap-label")
        .attr("x", 8)
        .attr("y", 19)
        .attr("pointer-events", "none")
        .style("font-size", (d) => Math.min(15, Math.max(10, (d.x1 - d.x0) / 7)))
        .style("font-weight", 700)
        .style("fill", "#ffffff")
        .style("opacity", 0)
        .text((d) => d.data.State)
        .each(function(d) {
            const maxChars = Math.floor((d.x1 - d.x0 - 14) / 7);
            if (maxChars < 2 || d.y1 - d.y0 < 24) {
                d3.select(this).remove();
            } else if (d.data.State.length > maxChars) {
                d3.select(this).text(`${d.data.State.slice(0, Math.max(1, maxChars - 1))}…`);
            }
        });

    chartTransition(treemapLabels, 450).delay(250).style("opacity", 1);

    const treemapValues = cells.append("text")
        .attr("class", "state-treemap-value")
        .attr("x", 8)
        .attr("y", 36)
        .attr("pointer-events", "none")
        .style("font-size", 10)
        .style("font-weight", 600)
        .style("fill", "#ffffff")
        .style("opacity", 0)
        .text((d) => d3.format(",")(d.data.Hospitalised_Injuries))
        .each(function(d) {
            if (d.x1 - d.x0 < 62 || d.y1 - d.y0 < 43) d3.select(this).remove();
        });
    chartTransition(treemapValues, 450).delay(350).style("opacity", 1);
}
