const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Conectare la MongoDB
const mongoURI = process.env.MONGODB_URI;

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Product Schema
const productSchema = new mongoose.Schema({
  equipment: String,
  articleNumber: String,
  timeRequired: String,
  elapsedTime: {
    type: Number,
    default: 0,
  },
  remainingTime: {
    // Adăugat pentru a salva timpul rămas
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["Not Started", "In Progress", "Paused", "Completed"],
    default: "Not Started",
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// Define Category Schema
const categorySchema = new mongoose.Schema({
  category: String,
  products: [productSchema],
});

// Create Category model
const Category = mongoose.model("Category", categorySchema);

// Load initial products from products.json
const loadInitialProducts = async () => {
  try {
    const dataPath = path.join(__dirname, "data", "products.json");
    const data = fs.readFileSync(dataPath, "utf8");
    const categories = JSON.parse(data);

    const count = await Category.countDocuments();
    if (count === 0) {
      await Category.insertMany(categories);
      console.log("Initial products inserted from products.json");
    }
  } catch (error) {
    console.error("Error reading products.json:", error);
  }
};

// Call the function to load initial products
loadInitialProducts();

// Routes
app.get("/", (req, res) => {
  res.send("Server is running.");
});

app.get("/products", async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: error.message });
  }
});

app.put("/products/:category/:productId", async (req, res) => {
  try {
    const { category, productId } = req.params;
    const { status, elapsedTime, remainingTime } = req.body;

    const decodedCategory = decodeURIComponent(category);
    const categoryData = await Category.findOne({ category: decodedCategory });
    if (categoryData) {
      const product = categoryData.products.id(productId);
      if (product) {
        product.status = status;
        if (elapsedTime !== undefined) product.elapsedTime = elapsedTime;
        if (remainingTime !== undefined) product.remainingTime = remainingTime; // Update remaining time

        await categoryData.save();
        res.json({ message: "Product updated successfully", product });
      } else {
        res.status(404).json({ message: "Product not found" });
      }
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
