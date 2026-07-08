<script lang="ts">
    /**
     * @file App.svelte
     *
     * @version 1.0.0
     * @author BleckWolf25
     * @license MIT
     *
     * @summary Svelte component for CodePulse.
     *
     * @description
     * This Svelte component serves as the main dashboard for the CodePulse VSCode extension.
     * It displays real-time code complexity metrics, including cyclomatic and cognitive complexity,
     * across multiple programming languages. The dashboard features interactive charts,
     * a live file feed, and actionable refactoring suggestions.
     *
     * @since 08/07/2026
     * @updated 08/07/2026
     */
    // ---------- IMPORTS
    import { onMount } from 'svelte';
    import { Chart, registerables } from 'chart.js';
    import { jsPDF } from 'jspdf';

    // ---------- REGISTER CHART.JS COMPONENTS
    Chart.register(...registerables);

    // ---------- TYPES
    type FunctionMetric = {
        name: string;
        startLine: number;
        endLine: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        suggestions: string[];
    };

    type FileMetric = {
        timestamp: string;
        filePath: string;
        language: string;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        sloc: number;
        functionMetrics?: FunctionMetric[];
    };

    type DashboardPayload = {
        workspaceName: string;
        metrics: FileMetric[];
    };

    // --------- STATE VARIABLES
    let workspaceName = 'CodePulse';
    let metrics: FileMetric[] = [];
    let searchQuery = '';
    let lastUpdated = new Date().toLocaleTimeString();

    let trendChart: Chart | undefined;
    let mixChart: Chart | undefined;
    let comparisonChart: Chart | undefined;
    let topFilesChart: Chart | undefined;

    // --------- VSCODE API INTEGRATION
    const vscode =
        (window as any).__vscodeApi ??
        ((window as any).__vscodeApi = (window as any).acquireVsCodeApi());

    // ---------- LIFECYCLE HOOKS
    onMount(() => {
        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'getDashboardData', payload: {} });
        setTimeout(() => renderCharts(), 100);

        return () => {
            window.removeEventListener('message', handleMessage);
            trendChart?.destroy();
            mixChart?.destroy();
            comparisonChart?.destroy();
            topFilesChart?.destroy();
        };
    });

    // PUBLIC HELPERS
    function handleMessage(event: MessageEvent<DashboardPayload>): void {
        const { data } = event;
        if (!data) {
            return;
        }

        workspaceName = data.workspaceName || workspaceName;
        metrics = Array.isArray(data.metrics) ? data.metrics : [];
        lastUpdated = new Date().toLocaleTimeString();
        setTimeout(() => renderCharts(), 50);
    }

    function requestRefresh(): void {
        vscode.postMessage({ command: 'getDashboardData', payload: {} });
    }

    function exportPdf(): void {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add title and headers
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(33, 150, 243); // CodePulse Blue
        doc.text('CodePulse Analysis Report', 14, 20);

        doc.setFontSize(12);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Workspace: ${workspaceName}`, 14, 28);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);

        // Add summary section
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 38, 196, 38);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(50, 50, 50);
        doc.text('Workspace Overview', 14, 46);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Total Analyzed Files: ${totalFiles}`, 14, 54);
        doc.text(`Total SLOC: ${totalSloc}`, 14, 60);
        doc.text(`Avg Cyclomatic Complexity: ${avgCyclomatic}`, 14, 66);
        doc.text(`Avg Cognitive Complexity: ${avgCognitive}`, 14, 72);

        doc.line(14, 78, 196, 78);

        // Capturing and adding Chart.js charts
        const charts = [
            { id: 'trendChart', title: 'Complexity Trend' },
            { id: 'mixChart', title: 'SLOC by Language' },
            { id: 'comparisonChart', title: 'Complexity by Language' },
            { id: 'topFilesChart', title: 'Highest Complexity Files' }
        ];

        let yOffset = 86;
        charts.forEach((c) => {
            const canvas = document.getElementById(c.id) as HTMLCanvasElement | null;
            if (canvas) {
                if (yOffset > 200) {
                    doc.addPage();
                    yOffset = 20;
                }
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(70, 70, 70);
                doc.text(c.title, 14, yOffset);

                try {
                    const imgData = canvas.toDataURL('image/png');
                    doc.addImage(imgData, 'PNG', 14, yOffset + 4, 182, 80);
                } catch (e) {
                    console.error('Error adding chart to PDF:', e);
                }

                yOffset += 94;
            }
        });

        // Add file table on a new page
        doc.addPage();
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(50, 50, 50);
        doc.text('Detailed File Complexity Breakdown', 14, 20);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);

        let tableY = 28;

        // Draw Table Header
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('File Name', 14, tableY);
        doc.text('Lang', 110, tableY);
        doc.text('Cyclo', 135, tableY);
        doc.text('Cogn', 155, tableY);
        doc.text('SLOC', 175, tableY);

        doc.line(14, tableY + 2, 196, tableY + 2);
        tableY += 8;

        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(80, 80, 80);

        for (const file of metrics) {
            if (tableY > 275) {
                doc.addPage();
                tableY = 20;
                // Redraw Header
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(50, 50, 50);
                doc.text('File Name', 14, tableY);
                doc.text('Lang', 110, tableY);
                doc.text('Cyclo', 135, tableY);
                doc.text('Cogn', 155, tableY);
                doc.text('SLOC', 175, tableY);
                doc.line(14, tableY + 2, 196, tableY + 2);
                doc.setFont('Helvetica', 'normal');
                doc.setTextColor(80, 80, 80);
                tableY += 8;
            }

            const name = file.filePath.split(/[/\\]/).pop() || file.filePath;
            const displayName = name.length > 30 ? name.substring(0, 27) + '...' : name;

            doc.text(displayName, 14, tableY);
            doc.text(file.language, 110, tableY);
            doc.text(String(file.cyclomaticComplexity), 135, tableY);
            doc.text(String(file.cognitiveComplexity), 155, tableY);
            doc.text(String(file.sloc), 175, tableY);

            tableY += 6;
        }

        const pdfBase64 = doc.output('datauristring').split(',')[1];
        vscode.postMessage({
            command: 'savePdf',
            data: pdfBase64,
            filename: `codepulse-report-${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`
        });
    }

    // Computed summary stats
    $: totalFiles = metrics.length;
    $: uniqueLanguages = new Set(metrics.map((m) => m.language)).size;
    $: totalCyclomatic = metrics.reduce((sum, m) => sum + (Number(m.cyclomaticComplexity) || 0), 0);
    $: totalCognitive = metrics.reduce((sum, m) => sum + (Number(m.cognitiveComplexity) || 0), 0);
    $: totalSloc = metrics.reduce((sum, m) => sum + (Number(m.sloc) || 0), 0);
    $: avgCyclomatic = totalFiles > 0 ? (totalCyclomatic / totalFiles).toFixed(1) : '0.0';
    $: avgCognitive = totalFiles > 0 ? (totalCognitive / totalFiles).toFixed(1) : '0.0';

    $: filteredMetrics = metrics
        .filter((m) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                m.filePath.toLowerCase().includes(q) ||
                m.language.toLowerCase().includes(q)
            );
        })
        .slice(0, 30);

    // Collect and sort all function metrics
    $: allFunctions = metrics
        .flatMap((m) => {
            const funcs = Array.isArray(m.functionMetrics) ? m.functionMetrics : [];
            return funcs.map((f: FunctionMetric) => ({
                ...f,
                filePath: m.filePath,
                fileName: getFileName(m.filePath),
            }));
        })
        .sort((a, b) => b.cognitiveComplexity + b.cyclomaticComplexity - (a.cognitiveComplexity + a.cyclomaticComplexity));

    $: highRiskFunctions = allFunctions
        .filter((f) => Array.isArray(f.suggestions) && f.suggestions.length > 0)
        .slice(0, 15);

    function getFileName(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || filePath;
    }

    function getFilePathDir(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/');
        if (parts.length <= 1) return '';
        return parts.slice(0, -1).join('/') + '/';
    }

    function getLanguageColor(lang: string): string {
        const colors: Record<string, string> = {
            typescript: '#38bdf8',
            typescriptreact: '#0ea5e9',
            javascript: '#fbbf24',
            javascriptreact: '#f59e0b',
            python: '#34d399',
            html: '#f97316',
            css: '#a855f7',
        };
        return colors[lang.toLowerCase()] || '#818cf8';
    }

    // ---------- CHARTS RENDERING
    function renderCharts(): void {
        const trendCanvas = document.getElementById('trendChart') as HTMLCanvasElement | null;
        const mixCanvas = document.getElementById('mixChart') as HTMLCanvasElement | null;
        const comparisonCanvas = document.getElementById('comparisonChart') as HTMLCanvasElement | null;
        const topFilesCanvas = document.getElementById('topFilesChart') as HTMLCanvasElement | null;

        if (!trendCanvas || !mixCanvas || !comparisonCanvas || !topFilesCanvas) {
            return;
        }

        trendChart?.destroy();
        mixChart?.destroy();
        comparisonChart?.destroy();
        topFilesChart?.destroy();

        // 1. Trend chart data
        const recentHistory = [...metrics]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-15);

        const trendLabels = recentHistory.map((m) => getFileName(m.filePath));
        const cycTrend = recentHistory.map((m) => m.cyclomaticComplexity);
        const cogTrend = recentHistory.map((m) => m.cognitiveComplexity);

        trendChart = new Chart(trendCanvas, {
            type: 'line',
            data: {
                labels: trendLabels.length ? trendLabels : ['No Data'],
                datasets: [
                    {
                        label: 'Cyclomatic Complexity',
                        data: cycTrend.length ? cycTrend : [0],
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        tension: 0.35,
                        fill: true,
                        pointBackgroundColor: '#38bdf8',
                    },
                    {
                        label: 'Cognitive Complexity',
                        data: cogTrend.length ? cogTrend : [0],
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        tension: 0.35,
                        fill: true,
                        pointBackgroundColor: '#a855f7',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e2e8f0' } },
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' }, beginAtZero: true },
                },
            },
        });

        // 2. Language Mix Chart
        const languageTotals = metrics.reduce<Record<string, number>>((acc, row) => {
            const lang = row.language || 'unknown';
            acc[lang] = (acc[lang] ?? 0) + (Number(row.sloc) || 0);
            return acc;
        }, {});

        const languageLabels = Object.keys(languageTotals);
        const languageValues = languageLabels.map((l) => languageTotals[l]);
        const palette = ['#38bdf8', '#34d399', '#fbbf24', '#a855f7', '#f472b6', '#60a5fa'];

        mixChart = new Chart(mixCanvas, {
            type: 'doughnut',
            data: {
                labels: languageLabels.length ? languageLabels : ['No Data'],
                datasets: [
                    {
                        data: languageValues.length ? languageValues : [1],
                        backgroundColor: palette,
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (_event, activeElements) => {
                    if (activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const label = languageLabels[index];
                        if (label) {
                            searchQuery = label;
                        }
                    }
                },
                plugins: {
                    legend: { position: 'right', labels: { color: '#e2e8f0' } },
                },
            },
        });

        // 3. Complexity Comparison by Language
        const langCycTotals: Record<string, { cyc: number; cog: number; count: number }> = {};
        for (const m of metrics) {
            const lang = m.language || 'unknown';
            if (!langCycTotals[lang]) {
                langCycTotals[lang] = { cyc: 0, cog: 0, count: 0 };
            }
            langCycTotals[lang].cyc += Number(m.cyclomaticComplexity) || 0;
            langCycTotals[lang].cog += Number(m.cognitiveComplexity) || 0;
            langCycTotals[lang].count += 1;
        }

        const compLangs = Object.keys(langCycTotals);
        const avgLangsCyc = compLangs.map((l) => Number((langCycTotals[l].cyc / Math.max(1, langCycTotals[l].count)).toFixed(1)));
        const avgLangsCog = compLangs.map((l) => Number((langCycTotals[l].cog / Math.max(1, langCycTotals[l].count)).toFixed(1)));

        comparisonChart = new Chart(comparisonCanvas, {
            type: 'bar',
            data: {
                labels: compLangs.length ? compLangs : ['No Data'],
                datasets: [
                    {
                        label: 'Avg Cyclomatic',
                        data: avgLangsCyc.length ? avgLangsCyc : [0],
                        backgroundColor: '#38bdf8',
                        borderRadius: 6,
                    },
                    {
                        label: 'Avg Cognitive',
                        data: avgLangsCog.length ? avgLangsCog : [0],
                        backgroundColor: '#a855f7',
                        borderRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (_event, activeElements) => {
                    if (activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const label = compLangs[index];
                        if (label) {
                            searchQuery = label;
                        }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#e2e8f0' } },
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' }, beginAtZero: true },
                },
            },
        });

        // 4. Top Most Complex Files Chart (Horizontal Bar)
        const topFiles = [...metrics]
            .sort((a, b) => ((Number(b.cyclomaticComplexity) || 0) + (Number(b.cognitiveComplexity) || 0)) - ((Number(a.cyclomaticComplexity) || 0) + (Number(a.cognitiveComplexity) || 0)))
            .slice(0, 6);

        const topLabels = topFiles.map((f) => getFileName(f.filePath));
        const topCyc = topFiles.map((f) => Number(f.cyclomaticComplexity) || 0);
        const topCog = topFiles.map((f) => f.cognitiveComplexity);

        topFilesChart = new Chart(topFilesCanvas, {
            type: 'bar',
            data: {
                labels: topLabels.length ? topLabels : ['No Data'],
                datasets: [
                    {
                        label: 'Cyclomatic',
                        data: topCyc.length ? topCyc : [0],
                        backgroundColor: '#fbbf24',
                        borderRadius: 4,
                    },
                    {
                        label: 'Cognitive',
                        data: topCog.length ? topCog : [0],
                        backgroundColor: '#f87171',
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (_event, activeElements) => {
                    if (activeElements.length > 0) {
                        const index = activeElements[0].index;
                        const file = topFiles[index];
                        if (file) {
                            searchQuery = getFileName(file.filePath);
                        }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#e2e8f0' } },
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' }, beginAtZero: true },
                    y: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                },
            },
        });
    }
</script>

<svelte:head>
    <title>CodePulse Analytics</title>
</svelte:head>

<div class="dashboard">
    <!-- Top Header -->
    <header class="top-header">
        <div class="header-left">
            <div class="title-row">
                <h1>CodePulse Analytics</h1>
                <span class="live-badge">
                    <span class="pulse-dot"></span>
                    LIVE REAL-TIME
                </span>
            </div>
            <p class="subtitle">Workspace: <strong>{workspaceName}</strong> &bull; Last updated: {lastUpdated}</p>
        </div>
        <div class="header-right">
            <button class="export-btn" on:click={exportPdf} title="Export PDF Report">
                <span>📄 Export PDF</span>
            </button>
            <button class="refresh-btn" on:click={requestRefresh} title="Sync latest data">
                <span>⚡ Refresh Now</span>
            </button>
        </div>
    </header>

    <!-- Hero KPI Grid -->
    <section class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Analyzed Files</div>
            <div class="kpi-value">{totalFiles}</div>
            <div class="kpi-subtext">Across {uniqueLanguages} language(s)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Avg Cyclomatic Complexity</div>
            <div class="kpi-value-row">
                <span class="kpi-value">{avgCyclomatic}</span>
                <span class="health-badge {Number(avgCyclomatic) < 10 ? 'health-good' : Number(avgCyclomatic) < 20 ? 'health-moderate' : 'health-high'}">
                    {Number(avgCyclomatic) < 10 ? 'Healthy' : Number(avgCyclomatic) < 20 ? 'Moderate' : 'High'}
                </span>
            </div>
            <div class="kpi-subtext">Target: &lt; 10 per file</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Avg Cognitive Complexity</div>
            <div class="kpi-value-row">
                <span class="kpi-value">{avgCognitive}</span>
                <span class="health-badge {Number(avgCognitive) < 10 ? 'health-good' : Number(avgCognitive) < 20 ? 'health-moderate' : 'health-high'}">
                    {Number(avgCognitive) < 10 ? 'Healthy' : Number(avgCognitive) < 20 ? 'Moderate' : 'High'}
                </span>
            </div>
            <div class="kpi-subtext">Maintainability index</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Total Lines of Code</div>
            <div class="kpi-value">{totalSloc.toLocaleString()}</div>
            <div class="kpi-subtext">Source lines analyzed</div>
        </div>
    </section>

    <!-- Charts Grid (2x2) -->
    <section class="charts-grid">
        <article class="chart-card">
            <div class="chart-header">
                <h2>Complexity Trend (Recent Files)</h2>
                <span class="chart-tag">Time Series</span>
            </div>
            <div class="chart-container"><canvas id="trendChart"></canvas></div>
        </article>
        <article class="chart-card">
            <div class="chart-header">
                <h2>SLOC by Language</h2>
                <span class="chart-tag">Distribution</span>
            </div>
            <div class="chart-container"><canvas id="mixChart"></canvas></div>
        </article>
        <article class="chart-card">
            <div class="chart-header">
                <h2>Complexity Breakdown by Language</h2>
                <span class="chart-tag">Comparison</span>
            </div>
            <div class="chart-container"><canvas id="comparisonChart"></canvas></div>
        </article>
        <article class="chart-card">
            <div class="chart-header">
                <h2>Highest Complexity Files</h2>
                <span class="chart-tag">Refactor Risk</span>
            </div>
            <div class="chart-container"><canvas id="topFilesChart"></canvas></div>
        </article>
    </section>

    <!-- Live Recent Files Feed -->
    <section class="table-card">
        <div class="table-header">
            <div>
                <h2>Real-Time Analyzed Files</h2>
                <p class="table-subtitle">Updates instantly on save, type, or file open</p>
            </div>
            <div class="search-box">
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search files or languages..."
                />
            </div>
        </div>

        {#if filteredMetrics.length === 0}
            <div class="empty-state">
                <p>No metrics found. Open or save a code file in your workspace to trigger real-time analysis!</p>
            </div>
        {:else}
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Language</th>
                            <th>Cyclomatic</th>
                            <th>Cognitive</th>
                            <th>SLOC</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each filteredMetrics as m}
                            <tr>
                                <td class="file-cell" title={m.filePath}>
                                    <span class="file-dir">{getFilePathDir(m.filePath)}</span>
                                    <span class="file-name">{getFileName(m.filePath)}</span>
                                </td>
                                <td>
                                    <span
                                        class="lang-badge"
                                        style="border-color: {getLanguageColor(m.language)}; color: {getLanguageColor(m.language)};"
                                    >
                                        {m.language}
                                    </span>
                                </td>
                                <td>
                                    <div class="score-bar-wrapper">
                                        <span class="score-num">{m.cyclomaticComplexity}</span>
                                        <div class="score-bar">
                                            <div
                                                class="score-fill"
                                                style="width: {Math.min(100, m.cyclomaticComplexity * 4)}%; background: {m.cyclomaticComplexity > 15 ? '#f87171' : '#38bdf8'};"
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="score-bar-wrapper">
                                        <span class="score-num">{m.cognitiveComplexity}</span>
                                        <div class="score-bar">
                                            <div
                                                class="score-fill"
                                                style="width: {Math.min(100, m.cognitiveComplexity * 4)}%; background: {m.cognitiveComplexity > 15 ? '#f87171' : '#a855f7'};"
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                                <td class="sloc-num">{m.sloc.toLocaleString()}</td>
                                <td class="time-cell">{new Date(m.timestamp).toLocaleTimeString()}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </section>

    <!-- Refactoring Recommendations Section -->
    <section class="table-card suggestions-card">
        <div class="table-header">
            <div>
                <h2>💡 Actionable Refactoring Suggestions</h2>
                <p class="table-subtitle">Targeted suggestions to simplify complex methods and functions</p>
            </div>
        </div>

        {#if highRiskFunctions.length === 0}
            <div class="empty-state">
                <p>All functions in your analyzed files are clean and healthy! Keep up the great work! ✨</p>
            </div>
        {:else}
            <div class="suggestions-list">
                {#each highRiskFunctions as f}
                    <div class="suggestion-item">
                        <div class="suggestion-meta">
                            <span class="suggestion-func">Method: <strong>{f.name}()</strong></span>
                            <span class="suggestion-file">{f.fileName} (Lines {f.startLine}-{f.endLine})</span>
                        </div>
                        <div class="suggestion-scores">
                            <span class="score-badge cyclo">Cyclomatic: {f.cyclomaticComplexity}</span>
                            <span class="score-badge cog">Cognitive: {f.cognitiveComplexity}</span>
                        </div>
                        <div class="suggestion-details">
                            {#each f.suggestions as s}
                                <div class="suggestion-bullet">
                                    <span class="bullet-icon">⚡</span>
                                    <span class="bullet-text">{s}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>
</div>

<style>
    :global(body) {
        margin: 0;
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
        background: var(--vscode-editor-background, #0f172a);
        color: var(--vscode-foreground, #e2e8f0);
    }

    .dashboard {
        padding: 1.5rem;
        max-width: 1600px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    /* Header */
    .top-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8));
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 0.75rem;
        padding: 1.25rem 1.5rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .title-row h1 {
        margin: 0;
        font-size: 1.6rem;
        font-weight: 700;
        background: linear-gradient(90deg, #38bdf8, #a855f7);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .live-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        border: 1px solid rgba(52, 211, 153, 0.3);
    }

    .pulse-dot {
        width: 8px;
        height: 8px;
        background: #34d399;
        border-radius: 50%;
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
    }

    .subtitle {
        margin: 0.35rem 0 0;
        font-size: 0.88rem;
        color: #94a3b8;
    }

    .header-right {
        display: flex;
        gap: 0.75rem;
        align-items: center;
    }

    .export-btn {
        background: rgba(168, 85, 247, 0.15);
        color: #a855f7;
        border: 1px solid rgba(168, 85, 247, 0.3);
        padding: 0.6rem 1.1rem;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .export-btn:hover {
        background: rgba(168, 85, 247, 0.25);
        transform: translateY(-1px);
    }

    .refresh-btn {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.3);
        padding: 0.6rem 1.1rem;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .refresh-btn:hover {
        background: rgba(56, 189, 248, 0.25);
        transform: translateY(-1px);
    }

    /* KPI Grid */
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
    }

    .kpi-card {
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 0.75rem;
        padding: 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: transform 0.2s, border-color 0.2s;
    }

    .kpi-card:hover {
        transform: translateY(-2px);
        border-color: rgba(56, 189, 248, 0.4);
    }

    .kpi-label {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        font-weight: 600;
    }

    .kpi-value-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .kpi-value {
        font-size: 1.85rem;
        font-weight: 700;
        color: #f8fafc;
    }

    .kpi-subtext {
        font-size: 0.8rem;
        color: #64748b;
    }

    .health-badge {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.2rem 0.5rem;
        border-radius: 0.35rem;
    }

    .health-good {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
    }

    .health-moderate {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
    }

    .health-high {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
    }

    /* Charts Grid */
    .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: 1.25rem;
    }

    .chart-card {
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 0.75rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 330px;
    }

    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .chart-header h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: #f1f5f9;
    }

    .chart-tag {
        font-size: 0.72rem;
        background: rgba(148, 163, 184, 0.12);
        color: #94a3b8;
        padding: 0.2rem 0.6rem;
        border-radius: 0.35rem;
        font-weight: 500;
    }

    .chart-container {
        flex: 1;
        position: relative;
        height: 250px;
    }

    /* Table */
    .table-card {
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 0.75rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1.2rem;
    }

    .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .table-header h2 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 600;
        color: #f1f5f9;
    }

    .table-subtitle {
        margin: 0.25rem 0 0;
        font-size: 0.84rem;
        color: #94a3b8;
    }

    .search-box input {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 0.5rem;
        padding: 0.55rem 0.9rem;
        color: #f8fafc;
        font-size: 0.88rem;
        min-width: 260px;
        outline: none;
    }

    .search-box input:focus {
        border-color: #38bdf8;
    }

    .table-responsive {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.88rem;
    }

    th {
        text-align: left;
        padding: 0.75rem 1rem;
        color: #94a3b8;
        font-weight: 600;
        border-bottom: 1px solid rgba(148, 163, 184, 0.15);
        white-space: nowrap;
    }

    td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.08);
        color: #e2e8f0;
    }

    tr:hover td {
        background: rgba(148, 163, 184, 0.04);
    }

    .file-cell {
        font-family: monospace;
        max-width: 380px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .file-dir {
        color: #64748b;
    }

    .file-name {
        font-weight: 600;
        color: #f8fafc;
    }

    .lang-badge {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        border-radius: 0.35rem;
        border: 1px solid;
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.03);
    }

    .score-bar-wrapper {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-width: 110px;
    }

    .score-num {
        font-weight: 600;
        width: 24px;
    }

    .score-bar {
        flex: 1;
        height: 6px;
        background: rgba(148, 163, 184, 0.15);
        border-radius: 3px;
        overflow: hidden;
    }

    .score-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .sloc-num {
        font-variant-numeric: tabular-nums;
        font-weight: 500;
    }

    .time-cell {
        color: #64748b;
        font-size: 0.82rem;
    }

    .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #64748b;
        font-size: 0.95rem;
    }

    .suggestions-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
    }

    .suggestion-item {
        background: rgba(30, 41, 59, 0.4);
        border: 1px solid rgba(148, 163, 184, 0.1);
        border-radius: 0.5rem;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .suggestion-meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        border-bottom: 1px dashed rgba(148, 163, 184, 0.15);
        padding-bottom: 0.4rem;
    }

    .suggestion-func {
        color: #38bdf8;
    }

    .suggestion-file {
        color: #94a3b8;
    }

    .suggestion-scores {
        display: flex;
        gap: 0.5rem;
    }

    .score-badge {
        padding: 0.15rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .score-badge.cyclo {
        background: rgba(251, 191, 36, 0.15);
        color: #fbbf24;
    }

    .score-badge.cog {
        background: rgba(168, 85, 247, 0.15);
        color: #a855f7;
    }

    .suggestion-details {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        margin-top: 0.3rem;
    }

    .suggestion-bullet {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: #e2e8f0;
    }

    .bullet-icon {
        color: #fbbf24;
    }

    @media (max-width: 768px) {
        .charts-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
