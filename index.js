const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage").GridFsStorage;
const { GridFSBucket } = require("mongodb");
const cors = require("cors");

const app = express();
app.use(cors());

// MongoDB URI
const mongoURI =
  "mongodb+srv://sukhvinder:sukhvinder%409729@cluster0.ziams1m.mongodb.net/image-store?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB
mongoose.connect(mongoURI, {});

// MongoDB Connection
const conn = mongoose.connection;

// GridFS Bucket Initialization
let gfsBucket;
conn.once("open", () => {
  gfsBucket = new GridFSBucket(conn.db, { bucketName: "uploads" });
  console.log("Connected to MongoDB and GridFS initialized.");
});

conn.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

// Create GridFS Storage Engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    if (!file.mimetype.startsWith("image/")) {
      return null; // Reject non-image files
    }
    return {
      filename: `${Date.now()}_${file.originalname}`,
      bucketName: "uploads", // Bucket name
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// Routes

// @route POST /upload
// @desc Uploads an image to MongoDB
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File upload failed." });
    }
    res.status(201).send({
      file: req.file,
      message: "File uploaded successfully",
    });
  } catch (err) {
    console.error("Error during file upload:", err);
    res.status(500).json({ message: "Internal server error", error: err });
  }
});

// @route GET /files
// @desc Get all files
app.get("/files", async (req, res) => {
  try {
    const files = await conn.db.collection("uploads.files").find().toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "No files found" });
    }
    res.status(200).json(files);
  } catch (err) {
    console.error("Error retrieving files:", err);
    res.status(500).json({ message: "Error retrieving files", error: err });
  }
});

// @route GET /files/:filename
// @desc Get a file by filename
app.get("/files/:filename", async (req, res) => {
  try {
    const file = await conn.db
      .collection("uploads.files")
      .findOne({ filename: req.params.filename });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }
    res.status(200).json(file);
  } catch (err) {
    console.error("Error retrieving file:", err);
    res.status(500).json({ message: "Error retrieving file", error: err });
  }
});

// @route GET /image/:filename
// @desc Stream and render an image by filename
app.get("/image/:filename", async (req, res) => {
  try {
    const file = await conn.db
      .collection("uploads.files")
      .findOne({ filename: req.params.filename });

    if (!file) {
      return res.status(404).json({ message: "Image not found" });
    }

    if (file.contentType && file.contentType.startsWith("image/")) {
      const readStream = gfsBucket.openDownloadStreamByName(file.filename);
      res.set("Content-Type", file.contentType);
      readStream.pipe(res);
    } else {
      res.status(400).json({ message: "File is not an image" });
    }
  } catch (err) {
    console.error("Error rendering image:", err);
    res.status(500).json({ message: "Error rendering image", error: err });
  }
});

// Default Error Handler
app.use((err, req, res, next) => {
  console.error("Error occurred:", err);
  res.status(500).json({ error: err.message });
});

// Default 404 Route
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
