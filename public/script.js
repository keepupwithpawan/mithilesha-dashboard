document.addEventListener("DOMContentLoaded", function () {
    // API Base URL (Updated for Render Deployment)
    const API_BASE_URL = "https://mithilesha-render.onrender.com/api";

    // Select DOM elements
    const productSelect = document.getElementById("product-select");
    const timeframeSelect = document.getElementById("timeframe-select");
    const salesNumber = document.getElementById("sales-number");
    const anomalyBox = document.getElementById("anomaly-box");

    let chartInstance = null;
    let currentData = null;

    async function fetchProducts() {
        try {
            updateLoadingState(true);
            const response = await fetch(`${API_BASE_URL}/products`);
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

    async function fetchProductData(product) {
        try {
            updateLoadingState(true);
            const response = await fetch(`${API_BASE_URL}/product/${product}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const data = await response.json();
            currentData = data;
            updateDashboard(data);
        } catch (error) {
            console.error("Error fetching product data:", error);
            showError("Failed to load product data.");
        } finally {
            updateLoadingState(false);
        }
    }

    function updateLoadingState(isLoading) {
        if (isLoading) {
            salesNumber.innerHTML = '<div class="loading-indicator">Loading...</div>';
            anomalyBox.innerHTML = '<div class="loading-indicator">Loading...</div>';
        }
    }

    function showError(message) {
        salesNumber.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
        anomalyBox.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
    }

    function updateDashboard(data) {
        updateSalesPrediction(data);
        updateAnomaliesSection(data);
        updateChartWithTimeframe(data, timeframeSelect.value);
    }

    function updateSalesPrediction(data) {
        const lastPrediction = data.predicted_sales.slice(-1)[0];
        const formattedPrediction = lastPrediction.toLocaleString();
        const previousPrediction = data.predicted_sales.length > 1 ? data.predicted_sales[data.predicted_sales.length - 2] : lastPrediction;
        const trendPercentage = ((lastPrediction - previousPrediction) / previousPrediction) * 100;
        const trendDirection = trendPercentage >= 0 ? '↑' : '↓';
        const trendClass = trendPercentage >= 0 ? 'positive-trend' : 'negative-trend';

        salesNumber.innerHTML = `
            <div class="prediction-value">${formattedPrediction} Units</div>
            <div class="prediction-trend ${trendClass}">
                ${trendDirection} ${Math.abs(trendPercentage).toFixed(1)}% from previous
            </div>
        `;
    }

    function updateAnomaliesSection(data) {
        if (data.anomalies && data.anomalies.length > 0) {
            anomalyBox.innerHTML = `<div class="anomaly-header">
                <span class="anomaly-icon">⚠️</span>
                <span class="anomaly-count">${data.anomalies.length} anomalies detected</span>
            </div>
            <ul class="anomaly-list">
                ${data.anomalies.map(date => `<li><div class="anomaly-date">${date}</div><div class="anomaly-info">Unusual sales pattern detected</div></li>`).join("")}
            </ul>`;
        } else {
            anomalyBox.innerHTML = `<div class="anomaly-empty">
                <span class="positive-icon">✅</span>
                <p>No anomalies detected</p>
            </div>`;
        }
    }

    function updateChartWithTimeframe(data, timeframe) {
        const numItems = timeframe === "1M" ? 30 : timeframe === "3M" ? 90 : timeframe === "6M" ? 180 : timeframe === "1Y" ? 365 : data.dates.length;
        const startIndex = Math.max(0, data.dates.length - numItems);

        updateChart(
            data.dates.slice(startIndex),
            data.predicted_sales.slice(startIndex),
            data.actual_sales.slice(startIndex),
            data.anomalies || []
        );
    }

    function updateChart(dates, predictions, actual, anomalies) {
        console.log("Updating chart...", dates, predictions, actual, anomalies);
        // Chart.js implementation goes here
    }

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

    fetchProducts();
});
