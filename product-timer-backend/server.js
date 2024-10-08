const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
  .then(() => console.log("Mit MongoDB verbunden"))
  .catch((err) => console.error("Fehler bei der MongoDB-Verbindung:", err));

// Define User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

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
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["Nicht gestartet", "In Bearbeitung", "Pausiert", "Abgeschlossen"],
    default: "Nicht gestartet",
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
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const Category = mongoose.model("Category", categorySchema);

// Middleware pentru autentificare
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.status(401).json({ message: "Token fehlt" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Ungültiges Token" });
    req.user = user;
    next();
  });
};

// Laden der initialen Produkte für einen Benutzer
const loadInitialProductsForUser = async (userId) => {
  try {
    const dataPath = path.join(__dirname, "data", "products.json");
    const data = fs.readFileSync(dataPath, "utf8");
    const categories = JSON.parse(data);

    // Füge die Benutzer-ID zu jeder Kategorie hinzu
    const categoriesWithUser = categories.map((category) => ({
      ...category,
      user: userId,
    }));

    await Category.insertMany(categoriesWithUser);
    console.log(`Initiale Produkte für Benutzer ${userId} geladen`);
  } catch (error) {
    console.error("Fehler beim Laden der initialen Produkte:", error);
  }
};

// Routen

// Benutzer registrieren
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Überprüfen, ob der Benutzer bereits existiert
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "Benutzer existiert bereits" });

    // Passwort hashen
    const hashedPassword = await bcrypt.hash(password, 10);

    // Benutzer erstellen
    const user = new User({ username, password: hashedPassword });
    await user.save();

    // Initiale Produkte für den Benutzer laden
    await loadInitialProductsForUser(user._id);

    res.json({ message: "Benutzer erfolgreich registriert" });
  } catch (error) {
    console.error("Fehler bei der Registrierung:", error);
    res.status(500).json({ message: error.message });
  }
});

// Benutzer einloggen
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Benutzer finden
    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: "Ungültige Anmeldedaten" });

    // Passwort überprüfen
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Ungültige Anmeldedaten" });

    // JWT Token generieren
    const payload = { userId: user._id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "Anmeldung erfolgreich", token });
  } catch (error) {
    console.error("Fehler bei der Anmeldung:", error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Server läuft.");
});

// Produkte des angemeldeten Benutzers abrufen
app.get("/products", authenticateToken, async (req, res) => {
  try {
    const categories = await Category.find({ user: req.user.userId });
    res.json(categories);
  } catch (error) {
    console.error("Fehler beim Abrufen der Kategorien:", error);
    res.status(500).json({ message: error.message });
  }
});

// Produkt des angemeldeten Benutzers aktualisieren
app.put(
  "/products/:category/:productId",
  authenticateToken,
  async (req, res) => {
    try {
      const { category, productId } = req.params;
      const { status, elapsedTime, remainingTime } = req.body;

      const decodedCategory = decodeURIComponent(category);

      // Kategorie finden, die zum Benutzer gehört
      const categoryData = await Category.findOne({
        category: decodedCategory,
        user: req.user.userId,
      });
      if (categoryData) {
        const product = categoryData.products.id(productId);
        if (product) {
          product.status = status;
          if (elapsedTime !== undefined) product.elapsedTime = elapsedTime;
          if (remainingTime !== undefined)
            product.remainingTime = remainingTime;

          await categoryData.save();
          res.json({ message: "Produkt erfolgreich aktualisiert", product });
        } else {
          res.status(404).json({ message: "Produkt nicht gefunden" });
        }
      } else {
        res.status(404).json({ message: "Kategorie nicht gefunden" });
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Produkts:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
