const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // Load environment variables from .env

const app = express();
const PORT = process.env.PORT || 5000; // Use the port from environment or default to 5000

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB Atlas
const mongoURI = process.env.MONGODB_URI; // Use environment variable for MongoDB URI
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
    // New field to track the date
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

    // Log incoming request
    console.log(
      `Updating product ID: ${productId} in category: ${category} with status: ${status} and elapsedTime: ${elapsedTime}`
    );

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
        console.error("Product not found");
        res.status(404).json({ message: "Product not found" });
      }
    } else {
      console.error("Category not found");
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
