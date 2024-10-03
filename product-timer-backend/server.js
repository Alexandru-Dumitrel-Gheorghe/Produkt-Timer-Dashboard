// server.js
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000; // Use environment variable for the port

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection string
const mongoURI =
  "mongodb+srv://alexpulan:1a2l3e4x555@cluster0.v5vru.mongodb.net/?retryWrites=true&w=majority";

// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Define Product Schema
const productSchema = new mongoose.Schema({
  equipment: String,
  articleNumber: String,
  timeRequired: String,
  elapsedTime: {
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

// Define Category Schema with nested products
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

    // Check if the categories collection is empty
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

// Get all categories and products
app.get("/products", async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update product status (start, pause, stop)
app.put("/products/:category/:productId", async (req, res) => {
  try {
    const { category, productId } = req.params;
    const { status, elapsedTime } = req.body;

    // Decode category in case it's URL-encoded
    const decodedCategory = decodeURIComponent(category);

    // Find the category and product to update
    const categoryData = await Category.findOne({ category: decodedCategory });
    if (categoryData) {
      const product = categoryData.products.id(productId);
      if (product) {
        // Update product details
        product.status = status;
        if (elapsedTime !== undefined) product.elapsedTime = elapsedTime;

        // Save changes
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

// Start the server (Vercel automatically handles this when deployed)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export the app for Vercel
module.exports = app;
