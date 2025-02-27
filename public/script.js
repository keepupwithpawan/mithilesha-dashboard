document.addEventListener("DOMContentLoaded", function () {
    const API_BASE_URL = "https://mithilesha-render.onrender.com/api";

    // Select DOM elements
    const productSelect = document.getElementById("product-select");
    const timeframeSelect = document.getElementById("timeframe-select");
    const salesNumber = document.getElementById("sales-number");
    const anomalyBox = document.getElementById("anomaly-box");
    
    // Track chart instance and current data
    let chartInstance = null;
    let currentData = null;
    
    /**
     * Fetches available products from the API and populates the dropdown
     */
    async function fetchProducts() {
        try {
            // Show loading state
            updateLoadingState(true);
            
            const response = await fetch("/${API_BASE_URL}/products");
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Clear loading option
            productSelect.innerHTML = '';
            
            // Add default prompt
            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "Select a product";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            productSelect.appendChild(defaultOption);
            
            // Add product options with formatted display names
            data.products.forEach(product => {
                const option = document.createElement("option");
                option.value = product;
                
                // Format the product name for better readability (convert snake_case to Title Case)
                option.textContent = product.split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                
                productSelect.appendChild(option);
            });
            
            // Select the first product by default if available
            if (data.products.length > 0) {
                productSelect.value = data.products[0];
                fetchProductData(data.products[0]);
            } else {
                // Handle case with no products
                showError("No products available");
                updateLoadingState(false);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
            showError("Failed to load products. Please try again later.");
            updateLoadingState(false);
        }
    }
    
    /**
     * Fetches data for a specific product
     * @param {string} product - The product identifier
     */
    async function fetchProductData(product) {
        try {
            // Show loading state
            updateLoadingState(true);
            
            const response = await fetch(`/api/product/${product}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            currentData = data;
            
            // Update the dashboard with the new data
            updateDashboard(data);
            
            // Hide loading state
            updateLoadingState(false);
        } catch (error) {
            console.error("Error fetching product data:", error);
            showError("Failed to load product data. Please try again later.");
            updateLoadingState(false);
        }
    }
    
    /**
     * Updates loading state across dashboard components
     * @param {boolean} isLoading - Whether the dashboard is in a loading state
     */
    function updateLoadingState(isLoading) {
        if (isLoading) {
            salesNumber.innerHTML = '<div class="loading-indicator">Loading sales data...</div>';
            anomalyBox.innerHTML = '<div class="loading-indicator">Loading anomaly data...</div>';
        }
    }
    
    /**
     * Shows error messages across dashboard components
     * @param {string} message - The error message to display
     */
    function showError(message) {
        salesNumber.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
        anomalyBox.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
    }
    
    /**
     * Updates all dashboard components with new data
     * @param {Object} data - The product data
     */
    function updateDashboard(data) {
        // Update the last predicted sales display
        updateSalesPrediction(data);
        
        // Update the anomalies section
        updateAnomaliesSection(data);
        
        // Update chart with filtered data based on timeframe
        updateChartWithTimeframe(data, timeframeSelect.value);
    }
    
    /**
     * Updates the sales prediction display
     * @param {Object} data - The product data
     */
    function updateSalesPrediction(data) {
        // Get the last prediction
        const lastPrediction = data.predicted_sales.slice(-1)[0];
        
        // Format the number with commas for thousands
        const formattedPrediction = lastPrediction.toLocaleString();
        
        // Get the second-to-last prediction for trend calculation
        const previousPrediction = data.predicted_sales.length > 1 
            ? data.predicted_sales[data.predicted_sales.length - 2] 
            : lastPrediction;
            
        // Calculate the trend percentage
        const trendPercentage = ((lastPrediction - previousPrediction) / previousPrediction) * 100;
        const trendDirection = trendPercentage >= 0 ? '↑' : '↓';
        const trendClass = trendPercentage >= 0 ? 'positive-trend' : 'negative-trend';
        
        // Update the prediction display with the trend
        salesNumber.innerHTML = `
            <div class="prediction-value">${formattedPrediction} Units</div>
            <div class="prediction-trend ${trendClass}">
                ${trendDirection} ${Math.abs(trendPercentage).toFixed(1)}% from previous
            </div>
        `;
    }
    
    /**
     * Updates the anomalies section with filtered data
     * @param {Object} data - The product data
     */
    function updateAnomaliesSection(data) {
        if (data.anomalies && data.anomalies.length > 0) {
            // Filter anomalies based on timeframe
            const filteredAnomalies = filterDataByTimeframe(data.anomalies, timeframeSelect.value);
            
            if (filteredAnomalies.length > 0) {
                let anomalyHTML = `<div class="anomaly-header">
                    <span class="anomaly-icon">⚠️</span>
                    <span class="anomaly-count">${filteredAnomalies.length} anomalies detected</span>
                </div>`;
                
                anomalyHTML += `<ul class="anomaly-list">`;
                
                filteredAnomalies.forEach(date => {
                    // Format the date for better readability
                    const formattedDate = formatDate(date);
                    
                    anomalyHTML += `
                        <li>
                            <div class="anomaly-date">${formattedDate}</div>
                            <div class="anomaly-info">Unusual sales pattern detected</div>
                        </li>
                    `;
                });
                
                anomalyHTML += `</ul>`;
                anomalyBox.innerHTML = anomalyHTML;
            } else {
                // No anomalies in the selected timeframe
                anomalyBox.innerHTML = `
                    <div class="anomaly-empty">
                        <span class="positive-icon">✅</span>
                        <p>No anomalies detected in the selected timeframe</p>
                    </div>
                `;
            }
        } else {
            // No anomalies at all
            anomalyBox.innerHTML = `
                <div class="anomaly-empty">
                    <span class="positive-icon">✅</span>
                    <p>No anomalies detected for this product</p>
                </div>
            `;
        }
    }
    
    /**
     * Formats a date string for better readability
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {string} Formatted date
     */
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    /**
     * Filters data array based on the selected timeframe
     * @param {Array} data - Array of date strings in YYYY-MM-DD format
     * @param {string} timeframe - Selected timeframe (1M, 3M, 6M, 1Y, ALL)
     * @returns {Array} Filtered array of dates
     */
    function filterDataByTimeframe(data, timeframe) {
        if (!data || data.length === 0) return [];
        if (timeframe === 'ALL') return data;
        
        const now = new Date();
        let monthsToGoBack = 1;
        
        switch (timeframe) {
            case '1M': monthsToGoBack = 1; break;
            case '3M': monthsToGoBack = 3; break;
            case '6M': monthsToGoBack = 6; break;
            case '1Y': monthsToGoBack = 12; break;
            default: monthsToGoBack = 3;
        }
        
        const cutoffDate = new Date();
        cutoffDate.setMonth(now.getMonth() - monthsToGoBack);
        
        // Filter array of date strings (YYYY-MM-DD format)
        return data.filter(dateStr => {
            const itemDate = new Date(dateStr);
            return itemDate >= cutoffDate;
        });
    }
    
    /**
     * Updates chart with data filtered by the selected timeframe
     * @param {Object} data - The product data
     * @param {string} timeframe - Selected timeframe (1M, 3M, 6M, 1Y, ALL)
     */
    function updateChartWithTimeframe(data, timeframe) {
        // Get number of items to include based on timeframe
        let numItems;
        
        switch (timeframe) {
            case '1M': numItems = 30; break;
            case '3M': numItems = 90; break;
            case '6M': numItems = 180; break;
            case '1Y': numItems = 365; break;
            case 'ALL': numItems = data.dates.length; break;
            default: numItems = 90;
        }
        
        // Limit the data to the selected timeframe (from the end)
        let startIndex = Math.max(0, data.dates.length - numItems);
        
        const filteredDates = data.dates.slice(startIndex);
        const filteredPredictions = data.predicted_sales.slice(startIndex);
        const filteredActual = data.actual_sales.slice(startIndex);
        
        // Get anomaly indices for highlighting on the chart
        const anomalyIndices = data.anomalies
            ? data.anomalies.map(anomalyDate => filteredDates.indexOf(anomalyDate))
                .filter(index => index !== -1)
            : [];
        
        updateChart(filteredDates, filteredPredictions, filteredActual, anomalyIndices);
    }
    
    /**
     * Creates or updates the sales chart
     * @param {Array} dates - Array of date strings
     * @param {Array} predictions - Array of predicted sales values
     * @param {Array} actual - Array of actual sales values
     * @param {Array} anomalyIndices - Indices of dates with anomalies
     */
    function updateChart(dates, predictions, actual, anomalyIndices) {
        const ctx = document.getElementById("sales-chart").getContext("2d");
        
        // Format dates for better display
        const formattedDates = dates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        // Create anomaly point style
        const anomalyPointStyle = anomalyIndices.reduce((acc, index) => {
            acc[index] = {
                radius: 6,
                backgroundColor: 'rgba(255, 0, 0, 0.7)',
                borderColor: 'red',
                borderWidth: 2
            };
            return acc;
        }, {});
        
        // Destroy existing chart if it exists
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        // Create new chart with improved styling
        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: formattedDates,
                datasets: [
                    { 
                        label: "Actual Sales",
                        data: actual,
                        borderColor: "#2563eb",
                        backgroundColor: "rgba(37, 99, 235, 0.1)",
                        borderWidth: 2,
                        fill: true,
                        tension: 0.2,
                        pointStyle: 'circle',
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: "#2563eb",
                        pointHoverBackgroundColor: "#1e40af",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 1.5,
                        pointStylePerPoint: anomalyPointStyle
                    },
                    { 
                        label: "Predicted Sales",
                        data: predictions,
                        borderColor: "#f59e0b",
                        borderDash: [5, 5],
                        backgroundColor: "rgba(245, 158, 11, 0.05)",
                        borderWidth: 2,
                        fill: true,
                        tension: 0.2,
                        pointStyle: 'circle',
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        pointBackgroundColor: "#f59e0b",
                        pointHoverBackgroundColor: "#d97706",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        callbacks: {
                            title: function(tooltipItems) {
                                return dates[tooltipItems[0].dataIndex];
                            },
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.raw;
                                return `${label}: ${value.toLocaleString()} units`;
                            },
                            afterLabel: function(context) {
                                // Check if this point is an anomaly
                                if (anomalyIndices.includes(context.dataIndex) && context.datasetIndex === 0) {
                                    return '⚠️ Anomaly detected';
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: true,
                            drawOnChartArea: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.6)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                if (value >= 1000) {
                                    return value / 1000 + 'k';
                                }
                                return value;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
    
    // Event Listeners
    productSelect.addEventListener("change", () => {
        if (productSelect.value) {
            fetchProductData(productSelect.value);
        }
    });
    
    timeframeSelect.addEventListener("change", () => {
        if (currentData) {
            updateDashboard(currentData);
        }
    });
    
        // Initialize by fetching products
        fetchProducts();
    });
