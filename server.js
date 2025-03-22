const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

// Load JSON data
const RESULTS_PATH = path.join(__dirname, "public", "data", "all_results.json");

app.get("/api/products", (req, res) => {
    if (!fs.existsSync(RESULTS_PATH)) {
        return res.status(404).json({ error: "No product data found" });
    }
    const data = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
    res.json({ products: Object.keys(data) });
});

app.get("/api/product/:productId", (req, res) => {
    if (!fs.existsSync(RESULTS_PATH)) {
        return res.status(404).json({ error: "Data not found" });
    }
    const data = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));
    const productId = req.params.productId;
    
    if (!data[productId]) {
        return res.status(404).json({ error: `Product ${productId} not found` });
    }

    res.json(data[productId]);
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
