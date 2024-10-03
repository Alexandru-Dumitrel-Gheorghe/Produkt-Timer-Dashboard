// server.js
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000; // Folosește variabila de mediu pentru port

// Configurarea middleware-ului
app.use(cors());
app.use(bodyParser.json());

// Conectare la MongoDB folosind variabila de mediu
mongoose
  .connect(process.env.MONGODB_URI, {
    connectTimeoutMS: 20000, // 20 de secunde
    socketTimeoutMS: 45000, // 45 de secunde
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// Definirea schema pentru produse
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

// Definirea schema pentru categorii cu produse încorporate
const categorySchema = new mongoose.Schema({
  category: String,
  products: [productSchema],
});

// Crearea modelului de categorie
const Category = mongoose.model("Category", categorySchema);

// Încărcarea produselor inițiale din products.json
const loadInitialProducts = async () => {
  try {
    const dataPath = path.join(__dirname, "data", "products.json");
    const data = fs.readFileSync(dataPath, "utf8");
    const categories = JSON.parse(data);

    // Verificarea dacă colecția de categorii este goală
    const count = await Category.countDocuments();
    if (count === 0) {
      await Category.insertMany(categories);
      console.log("Initial products inserted from products.json");
    }
  } catch (error) {
    console.error("Error reading products.json:", error);
  }
};

// Apelarea funcției pentru a încărca produsele inițiale
loadInitialProducts();

// Rutele

// Obține toate categoriile și produsele
app.get("/products", async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: error.message });
  }
});

// Actualizarea stării produsului (începere, pauză, oprire)
app.put("/products/:category/:productId", async (req, res) => {
  try {
    const { category, productId } = req.params;
    const { status, elapsedTime } = req.body;

    // Decodificarea categoriei în cazul în care este codificată URL
    const decodedCategory = decodeURIComponent(category);

    // Găsirea categoriei și produsului de actualizat
    const categoryData = await Category.findOne({ category: decodedCategory });
    if (categoryData) {
      const product = categoryData.products.id(productId);
      if (product) {
        // Actualizarea detaliilor produsului
        product.status = status;
        if (elapsedTime !== undefined) product.elapsedTime = elapsedTime;

        // Salvarea modificărilor
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

// Pornirea serverului
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Exportarea aplicației pentru Vercel
module.exports = app;
