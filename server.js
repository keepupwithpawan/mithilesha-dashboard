const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parse/sync');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

// Configure CORS
app.use(cors({
  origin: ['https://mithilesha-dashboard.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors({ origin: "*" }));

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set in .env file');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// File paths
const CSV_PATH = path.join(__dirname, 'apple_sales_2024.csv');
const JSON_PATH = path.join(__dirname, 'public', 'data', 'all_results.json');
const STOCK_HTML_PATH = path.join(__dirname, 'public', 'stock.html');
const RESULTS_PATH = JSON_PATH; // Unified path for JSON data

// Function to read and parse CSV data
function loadCSVData() {
    try {
        const csvText = fs.readFileSync(CSV_PATH, 'utf8');
        const records = csvParser.parse(csvText, { columns: true, skip_empty_lines: true });
        return records;
    } catch (error) {
        console.error(`Error loading CSV: ${error.message}`);
        return [];
    }
}

// Function to read JSON data
function loadJSONData() {
    try {
        const jsonText = fs.readFileSync(JSON_PATH, 'utf8');
        return JSON.parse(jsonText);
    } catch (error) {
        console.error(`Error loading JSON: ${error.message}`);
        return {};
    }
}

// Function to extract stock levels from stock.html
function extractStockDataFromHTML() {
    try {
        const htmlText = fs.readFileSync(STOCK_HTML_PATH, 'utf8');
        const dom = new JSDOM(htmlText);
        const document = dom.window.document;

        const stockItems = {};
        const stockElements = document.querySelectorAll('.stock-number');
        stockElements.forEach((element) => {
            const productTitle = element.closest('.prediction-card').querySelector('.card-title').textContent.split(' ')[0] + '_' + element.closest('.prediction-card').querySelector('.card-title').textContent.split(' ')[1];
            const stockText = element.textContent.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*Units/);
            if (stockText) {
                stockItems[productTitle] = parseInt(stockText[1].replace(/,/g, ''), 10);
            }
        });
        return stockItems;
    } catch (error) {
        console.error(`Error parsing stock.html: ${error.message}`);
        return {};
    }
}

// System prompt with dynamic data injection
function generateSystemPrompt(csvData, jsonData, stockData) {
    const csvSample = csvData.slice(0, 5).map(row => JSON.stringify(row)).join('\n');
    const jsonSample = JSON.stringify(jsonData['MacBook_Pro_Stock'] || {}).slice(0, 500) + '...';
    const stockSummary = Object.entries(stockData)
        .map(([product, stock]) => `${product.replace('_', ' ')}: ${stock} units`)
        .join('\n');

    return `
You are an AI assistant for Mithilesha Analytics, a platform that tracks Apple product inventory and sales predictions for 2024. Here's the context:

1. **Dataset**: apple_sales_2024.csv contains daily stock levels, prices, and discounts for MacBook Pro, iPad Air, iPhone 15 Pro, AirPods Pro, and Apple Watch Ultra.
   Sample data: 
   ${csvSample || 'No CSV data available'}

2. **Predictions**: all_results.json contains LSTM model predictions with dates, actual sales, predicted sales, and anomalies.
   Sample data: ${jsonSample || 'No JSON data available'}

3. **Current Stock Levels** (from stock.html):
   ${stockSummary || 'No stock data available'}

4. **Dashboard Features**:
   - Sales Performance Chart: Compares actual vs predicted sales over time
   - Predicted Sales: Shows AI forecast with trend percentage
   - Anomaly Detection: Highlights unusual patterns
   - Timeframes: 1M (15 days), 3M (30 days), 6M (45 days), 1Y (60 days), ALL (72 days from Oct 21-Dec 31, 2024)

5. **Stock Status**: Low (<400 units), High (>600 units)

Answer questions about:
- Stock levels and trends
- Sales data analysis (calculate sales as stock changes, considering price/discount if available)
- Dataset explanation
- Dashboard graph interpretations
- Project purpose
Use the provided data to calculate and infer trends or totals where possible.
`;
}

// Original server.js endpoints
app.get("/api/products", (req, res) => {
    if (!fs.existsSync(JSON_PATH)) {
        return res.status(404).json({ error: "No product data found" });
    }
    const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
    res.json({ products: Object.keys(data) });
});

app.get("/api/product/:productId", (req, res) => {
    if (!fs.existsSync(JSON_PATH)) {
        return res.status(404).json({ error: "Data not found" });
    }
    const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
    const productId = req.params.productId;
    
    if (!data[productId]) {
        return res.status(404).json({ error: `Product ${productId} not found` });
    }

    res.json(data[productId]);
});

// Chat endpoint from chatbot.js
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        console.log('Received empty message');
        return res.status(400).json({ error: 'Message required' });
    }

    try {
        console.log('Processing message:', message);

        const csvData = loadCSVData();
        const jsonData = loadJSONData();
        const stockData = extractStockDataFromHTML();
        const systemPrompt = generateSystemPrompt(csvData, jsonData, stockData);

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: 'Understood! How can I assist you with Mithilesha Analytics?' }] }
            ]
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();
        console.log('Response from Gemini:', text);
        res.json({ message: text });
    } catch (error) {
        console.error('Chat error:', error.stack || error.message);
        res.status(500).json({ error: 'Failed to process request', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
