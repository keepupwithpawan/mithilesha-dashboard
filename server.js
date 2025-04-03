const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parse/sync');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Dynamic CORS configuration
const ALLOWED_ORIGINS = [
    'https://mithilesha-render.onrender.com',  // Replace with your actual frontend domain
    'http://localhost:3000',  // Local development
    'http://localhost:5000'   // Server port
];

app.use(cors({
    origin: function(origin, callback){
        // Allow requests with no origin (like mobile apps or curl requests)
        if(!origin) return callback(null, true);
        
        if(ALLOWED_ORIGINS.indexOf(origin) === -1){
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set in .env file');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Fallback file paths with error handling
const CSV_PATH = path.join(__dirname, 'apple_sales_2024.csv');
const JSON_PATH = path.join(__dirname, 'public', 'data', 'all_results.json');
const STOCK_HTML_PATH = path.join(__dirname, 'public', 'stock.html');

// Function to read and parse CSV data with robust error handling
function loadCSVData() {
    try {
        if (!fs.existsSync(CSV_PATH)) {
            console.warn(`CSV file not found at ${CSV_PATH}`);
            return [];
        }
        const csvText = fs.readFileSync(CSV_PATH, 'utf8');
        const records = csvParser.parse(csvText, { 
            columns: true, 
            skip_empty_lines: true 
        });
        return records;
    } catch (error) {
        console.error(`Error loading CSV: ${error.message}`);
        return [];
    }
}

// Function to read JSON data with robust error handling
function loadJSONData() {
    try {
        if (!fs.existsSync(JSON_PATH)) {
            console.warn(`JSON file not found at ${JSON_PATH}`);
            return {};
        }
        const jsonText = fs.readFileSync(JSON_PATH, 'utf8');
        return JSON.parse(jsonText);
    } catch (error) {
        console.error(`Error loading JSON: ${error.message}`);
        return {};
    }
}

// Function to extract stock levels from stock.html with robust error handling
function extractStockDataFromHTML() {
    try {
        if (!fs.existsSync(STOCK_HTML_PATH)) {
            console.warn(`Stock HTML file not found at ${STOCK_HTML_PATH}`);
            return {};
        }
        const htmlText = fs.readFileSync(STOCK_HTML_PATH, 'utf8');
        const dom = new JSDOM(htmlText);
        const document = dom.window.document;

        const stockItems = {};
        const stockElements = document.querySelectorAll('.stock-number');
        stockElements.forEach((element) => {
            const productCard = element.closest('.prediction-card');
            if (productCard) {
                const titleParts = productCard.querySelector('.card-title').textContent.split(' ');
                const productTitle = `${titleParts[0]}_${titleParts[1]}`;
                const stockText = element.textContent.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*Units/);
                
                if (stockText) {
                    stockItems[productTitle] = parseInt(stockText[1].replace(/,/g, ''), 10);
                }
            }
        });
        return stockItems;
    } catch (error) {
        console.error(`Error parsing stock.html: ${error.message}`);
        return {};
    }
}

// System prompt generation with fallback data
function generateSystemPrompt(csvData, jsonData, stockData) {
    const csvSample = csvData.length > 0 
        ? csvData.slice(0, 5).map(row => JSON.stringify(row)).join('\n')
        : 'No CSV data available';
    
    const jsonSample = jsonData['MacBook_Pro_Stock']
        ? JSON.stringify(jsonData['MacBook_Pro_Stock']).slice(0, 500) + '...'
        : 'No JSON data available';
    
    const stockSummary = Object.entries(stockData).length > 0
        ? Object.entries(stockData)
            .map(([product, stock]) => `${product.replace('_', ' ')}: ${stock} units`)
            .join('\n')
        : 'No stock data available';

    return `
You are an AI assistant for Mithilesha Analytics, a platform tracking Apple product inventory and sales predictions for 2024.

Context:
1. Dataset (apple_sales_2024.csv):
   ${csvSample}

2. Predictions (all_results.json):
   ${jsonSample}

3. Current Stock Levels:
   ${stockSummary}

Dashboard Features:
- Sales Performance Chart
- Predicted Sales with trend percentage
- Anomaly Detection
- Timeframes: 1M, 3M, 6M, 1Y, ALL

Stock Status:
- Low: <400 units
- High: >600 units

Provide insights based on available data.
`;
}

// API Endpoints
app.get("/api/products", (req, res) => {
    try {
        const data = loadJSONData();
        res.json({ products: Object.keys(data) });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve products" });
    }
});

app.get("/api/product/:productId", (req, res) => {
    try {
        const data = loadJSONData();
        const productId = req.params.productId;
        
        if (!data[productId]) {
            return res.status(404).json({ error: `Product ${productId} not found` });
        }

        res.json(data[productId]);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve product data" });
    }
});

// Enhanced Chat Endpoint
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    try {
        const csvData = loadCSVData();
        const jsonData = loadJSONData();
        const stockData = extractStockDataFromHTML();
        const systemPrompt = generateSystemPrompt(csvData, jsonData, stockData);

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: 'Understood! I am ready to help with Mithilesha Analytics data.' }] }
            ]
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();
        
        res.json({ message: text });
    } catch (error) {
        console.error('Chat processing error:', error);
        res.status(500).json({ 
            error: 'Failed to process request', 
            details: error.message 
        });
    }
});

// Fallback route for all other requests
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
