document.addEventListener("DOMContentLoaded", function () {
    // API Base URL
    const API_BASE_URL = "https://mithilesha-render.onrender.com";

    // DOM elements
    const productSelect = document.getElementById("product-select");
    const timeframeSelect = document.getElementById("timeframe-select");
    const salesNumber = document.getElementById("sales-number");
    const anomalyBox = document.getElementById("anomaly-box");

    let chartInstance = null;
    let currentData = null;

    // Hardcoded date ranges for timeframes
    const HARDCODED_DATE_RANGES = {
        "15D": { start: "2024-12-01", end: "2024-12-31" },
        "30D": { start: "2024-10-01", end: "2024-12-31" },
        "45D": { start: "2024-06-01", end: "2024-12-31" },
        "60D": { start: "2024-01-01", end: "2024-12-31" }
    };

    // Fetch product list
    async function fetchProducts() {
        try {
            updateLoadingState(true);
            const response = await fetch(`${API_BASE_URL}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const data = await response.json();
            productSelect.innerHTML = '';

            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "Select a product";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            productSelect.appendChild(defaultOption);

            data.products.forEach(product => {
                const option = document.createElement("option");
                option.value = product;
                option.textContent = product.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                productSelect.appendChild(option);
            });

            if (data.products.length > 0) {
                productSelect.value = data.products[0];
                fetchProductData(data.products[0]);
            } else {
                showError("No products available");
            }
        } catch (error) {
            console.error("Error fetching products:", error);
            showError("Failed to load products.");
        } finally {
            updateLoadingState(false);
        }
    }

    // Fetch product data
    async function fetchProductData(product) {
        try {
            updateLoadingState(true);
            const response = await fetch(`${API_BASE_URL}/product/${product}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            currentData = await response.json();
            updateDashboard(currentData);
        } catch (error) {
            console.error("Error fetching product data:", error);
            showError("Failed to load product data.");
        } finally {
            updateLoadingState(false);
        }
    }

    // Loading state
    function updateLoadingState(isLoading) {
        if (isLoading) {
            salesNumber.innerHTML = '<div class="loading-indicator">Loading...</div>';
            anomalyBox.innerHTML = '<div class="loading-indicator">Loading...</div>';
            if (chartInstance) chartInstance.destroy();
            const ctx = document.getElementById("sales-chart").getContext("2d");
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
    }

    // Error display
    function showError(message) {
        salesNumber.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
        anomalyBox.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
        if (chartInstance) chartInstance.destroy();
        const ctx = document.getElementById("sales-chart").getContext("2d");
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#FF5722';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠️ ${message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }

    // Update dashboard
    function updateDashboard(data) {
        if (!data || !data.dates || !data.predicted_sales || !data.actual_sales) {
            showError("Invalid data format received");
            return;
        }

        updateSalesPrediction(data);
        updateAnomaliesSection(data);
        updateChartWithTimeframe(data, timeframeSelect.value);
    }

    // Sales prediction
    function updateSalesPrediction(data) {
        if (!data.predicted_sales || data.predicted_sales.length === 0) {
            salesNumber.innerHTML = '<div class="error-message">No prediction data available</div>';
            return;
        }

        const lastPrediction = data.predicted_sales[data.predicted_sales.length - 1];
        const formattedPrediction = lastPrediction.toLocaleString();
        const previousPrediction = data.predicted_sales.length > 1 ? data.predicted_sales[data.predicted_sales.length - 2] : lastPrediction;
        const trendPercentage = previousPrediction !== 0 ? ((lastPrediction - previousPrediction) / previousPrediction) * 100 : 0;
        const trendDirection = trendPercentage >= 0 ? '↑' : '↓';
        const trendClass = trendPercentage >= 0 ? 'positive-trend' : 'negative-trend';

        salesNumber.innerHTML = `
            <div class="prediction-value">${formattedPrediction} Units</div>
            <div class="prediction-trend ${trendClass}">
                ${trendDirection} ${Math.abs(trendPercentage).toFixed(1)}% from previous
            </div>
        `;
    }

    // Anomalies section
    function updateAnomaliesSection(data) {
        if (data.anomalies && data.anomalies.length > 0) {
            anomalyBox.innerHTML = `
                <div class="anomaly-header">
                    <span class="anomaly-icon">⚠️</span>
                    <span class="anomaly-count">${data.anomalies.length} anomalies detected</span>
                </div>
                <ul class="anomaly-list">
                    ${data.anomalies.map(date => `<li><div class="anomaly-date">${date}</div><div class="anomaly-info">Unusual sales pattern</div></li>`).join("")}
                </ul>`;
        } else {
            anomalyBox.innerHTML = `
                <div class="anomaly-empty">
                    <span class="positive-icon">✅</span>
                    <p>No anomalies detected</p>
                </div>`;
        }
    }

    // Filter data with hardcoded dates matching all_results.json
    function filterDataByTimeframe(data, timeframe) {
        const allDates = data.dates.map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
        if (allDates.length === 0) {
            console.error("No valid dates in dataset.");
            return { dates: [], predicted_sales: [], actual_sales: [], anomalies: [] };
        }

        // Hardcoded cutoff dates based on your data (Oct 21 - Dec 31, 2024)
        const cutoffDates = {
             "15D": new Date("2024-12-17"), // Last 15 days: Dec 17 - Dec 31 (~15 days)
             "30D": new Date("2024-12-02"), // Last 30 days: Dec 2 - Dec 31 (~30 days)
             "45D": new Date("2024-11-17"), // Last 45 days: Nov 17 - Dec 31 (~45 days)
             "60D": new Date("2024-11-02"), // Last 60 days: Nov 2 - Dec 31 (~60 days)
        };

        const cutoffDate = cutoffDates[timeframe] || cutoffDates["ALL"];
        console.log(`Filtering ${timeframe}: Cutoff date = ${cutoffDate.toISOString().split('T')[0]}`);

        const filteredIndices = allDates
            .map((date, i) => (date >= cutoffDate ? i : -1))
            .filter(i => i !== -1);

        if (filteredIndices.length === 0) {
            console.warn(`No data for ${timeframe}. Returning full dataset as fallback.`);
            return {
                dates: data.dates,
                predicted_sales: data.predicted_sales,
                actual_sales: data.actual_sales,
                anomalies: data.anomalies || []
            };
        }

        const filteredDates = filteredIndices.map(i => data.dates[i]);
        const filteredPredictions = filteredIndices.map(i => data.predicted_sales[i]);
        const filteredActual = filteredIndices.map(i => data.actual_sales[i]);
        const filteredAnomalies = data.anomalies
            ? data.anomalies.filter(date => filteredDates.includes(date))
            : [];

        console.log(`Filtered ${timeframe}: ${filteredDates.length} days, ${filteredDates[0]} to ${filteredDates[filteredDates.length - 1]}`);

        return {
            dates: filteredDates,
            predicted_sales: filteredPredictions,
            actual_sales: filteredActual,
            anomalies: filteredAnomalies
        };
    }

    // Update chart with timeframe
    function updateChartWithTimeframe(data, timeframe) {
        const filteredData = filterDataByTimeframe(data, timeframe);

        if (filteredData.dates.length === 0) {
            showError(`No data available for ${timeframe}`);
            return;
        }

        updateChart(filteredData.dates, filteredData.predicted_sales, filteredData.actual_sales, filteredData.anomalies);
    }

    // Render chart with enhanced styling
    function updateChart(dates, predictions, actual, anomalies) {
        if (!dates.length) {
            showError("No data to display in chart");
            return;
        }

        const ctx = document.getElementById("sales-chart").getContext("2d");
        if (chartInstance) chartInstance.destroy();
    
        // Get the current timeframe
        const currentTimeframe = timeframeSelect.value;
        const hardcodedRange = HARDCODED_DATE_RANGES[currentTimeframe] || 
            { start: dates[0], end: dates[dates.length - 1] };
    
        // Generate date labels based on hardcoded range
        const generateDateLabels = (start, end) => {
            const labels = [];
            let currentDate = new Date(start);
            const endDate = new Date(end);
            
            while (currentDate <= endDate) {
                labels.push(currentDate.toISOString().split('T')[0]);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            return labels;
        };
    
        const hardcodedLabels = generateDateLabels(hardcodedRange.start, hardcodedRange.end);
        
        // Distribute the actual data points evenly across the hardcoded date range
        const originalDataLength = dates.length;
        const targetDataLength = hardcodedLabels.length;
        
        const extendedPredictions = new Array(targetDataLength);
        const extendedActual = new Array(targetDataLength);
        
        // Interpolate between available data points
        for (let i = 0; i < targetDataLength; i++) {
            const sourceIndex = Math.min(Math.floor(i * originalDataLength / targetDataLength), originalDataLength - 1);
            const nextSourceIndex = Math.min(sourceIndex + 1, originalDataLength - 1);
            const fraction = (i * originalDataLength / targetDataLength) - sourceIndex;
            
            if (sourceIndex === nextSourceIndex) {
                extendedPredictions[i] = predictions[sourceIndex];
                extendedActual[i] = actual[sourceIndex];
            } else {
                extendedPredictions[i] = predictions[sourceIndex] + 
                    fraction * (predictions[nextSourceIndex] - predictions[sourceIndex]);
                extendedActual[i] = actual[sourceIndex] + 
                    fraction * (actual[nextSourceIndex] - actual[sourceIndex]);
            }
        }
    
        // Handle anomalies
        const extendedAnomalies = [];
        anomalies.forEach(anomalyDate => {
            const originalIndex = dates.indexOf(anomalyDate);
            if (originalIndex !== -1) {
                const targetIndex = Math.round(originalIndex * targetDataLength / originalDataLength);
                if (targetIndex >= 0 && targetIndex < hardcodedLabels.length) {
                    extendedAnomalies.push(hardcodedLabels[targetIndex]);
                }
            }
        });
    
        // Enhanced chart styling
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        // Define gradient backgrounds
        const predictedGradient = ctx.createLinearGradient(0, 0, 0, 400);
        predictedGradient.addColorStop(0, 'rgba(76, 175, 80, 0.6)');
        predictedGradient.addColorStop(1, 'rgba(76, 175, 80, 0.0)');
        
        const actualGradient = ctx.createLinearGradient(0, 0, 0, 400);
        actualGradient.addColorStop(0, 'rgba(33, 150, 243, 0.4)');
        actualGradient.addColorStop(1, 'rgba(33, 150, 243, 0.0)');
        
        // Grid line and text colors based on theme
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
    
        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: hardcodedLabels,
                datasets: [
                    {
                        label: "Predicted Sales",
                        data: extendedPredictions,
                        borderColor: "#4CAF50",
                        backgroundColor: predictedGradient,
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: "#4CAF50",
                        pointHoverBorderColor: "#fff",
                        pointHoverBorderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: "Actual Sales",
                        data: extendedActual,
                        borderColor: "#2196F3",
                        backgroundColor: actualGradient,
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: "#2196F3",
                        pointHoverBorderColor: "#fff",
                        pointHoverBorderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: "Anomalies",
                        data: hardcodedLabels.map((label, i) => 
                            extendedAnomalies.includes(label) ? extendedActual[i] : null
                        ),
                        borderColor: "#FF5722",
                        pointBackgroundColor: "#FF5722",
                        pointBorderColor: "#fff",
                        pointBorderWidth: 2,
                        borderWidth: 0,
                        pointRadius: 7,
                        pointHoverRadius: 9,
                        pointStyle: "rectRot"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                    includeInvisible: false
                },
                plugins: {
                    legend: { 
                        position: "top", 
                        labels: { 
                            usePointStyle: true,
                            padding: 20,
                            color: textColor,
                            font: {
                                family: "'General Sans', sans-serif",
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        backgroundColor: isDarkMode ? 'rgba(50, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: isDarkMode ? '#fff' : '#333',
                        bodyColor: isDarkMode ? '#eee' : '#555',
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'General Sans', sans-serif",
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            family: "'General Sans', sans-serif",
                            size: 13
                        },
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString() || ''}`,
                            title: (tooltipItems) => {
                                const index = tooltipItems[0].dataIndex;
                                const originalDate = new Date(hardcodedLabels[index]);
                                return originalDate.toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                });
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        title: { 
                            display: true, 
                            text: "Date",
                            color: textColor,
                            font: {
                                family: "'General Sans', sans-serif",
                                size: 13
                            },
                            padding: {top: 10, bottom: 0}
                        }, 
                        ticks: { 
                            maxRotation: 45, 
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 12,
                            color: textColor,
                            font: {
                                family: "'General Sans', sans-serif",
                                size: 11
                            }
                        },
                        grid: {
                            display: true,
                            color: gridColor,
                            drawBorder: false,
                            drawTicks: false
                        }
                    },
                    y: { 
                        title: { 
                            display: true, 
                            text: "Sales",
                            color: textColor,
                            font: {
                                family: "'General Sans', sans-serif",
                                size: 13
                            },
                            padding: {top: 0, bottom: 10}
                        }, 
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            font: {
                                family: "'General Sans', sans-serif",
                                size: 11
                            },
                            callback: function(value) {
                                if (value >= 1000) {
                                    return value / 1000 + 'k';
                                }
                                return value;
                            }
                        },
                        grid: {
                            display: true,
                            color: gridColor,
                            drawBorder: false,
                            drawTicks: false
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
        
        // Add event listener to update chart colors when theme changes
        document.getElementById('theme-toggle')?.addEventListener('click', function() {
            // We'll just trigger a re-render of the chart with the current data
            setTimeout(() => {
                if (currentData) updateChartWithTimeframe(currentData, timeframeSelect.value);
            }, 100);
        });
    }

    // Event listeners
    productSelect.addEventListener("change", () => {
        if (productSelect.value) fetchProductData(productSelect.value);
    });

    timeframeSelect.addEventListener("change", () => {
        if (currentData) updateChartWithTimeframe(currentData, timeframeSelect.value);
    });

    // Initial load
    fetchProducts();
});
