// index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { Application } from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    "https://foodiezone-nu.vercel.app",
    "http://localhost:3000",
  ],
  credentials: true,
}));


app.use(express.json());

const uri = process.env.MONGODB_URI || "";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

console.log(
  "🔑 GEMINI_API_KEY loaded:",
  process.env.GEMINI_API_KEY ? "Yes" : "❌ MISSING!"
);



const SYSTEM_PROMPT = `You are CravingByte's AI assistant — a friendly food ordering app assistant.
You help users find dishes, understand categories, track orders, and navigate the app.
Keep answers short, warm, and practical. If asked something outside food/ordering context, gently redirect.`;




 client.connect();
console.log("MongoDB Connected");

    const db = client.db("Foddie");
    const foodsCollection = db.collection("menu");
    const conversationsCollection = db.collection("conversations");
    const favoriteCollection = db.collection("wishlist")
    const reviewsCollection = db.collection("review")

    // ===========================
    // Add Food
    // ===========================
    app.post("/menu", async (req, res) => {
      try {
        const food = req.body;

        if (!food.name || !food.price || !food.category) {
          return res.status(400).send({
            message: "Name, price, and category are required",
          });
        }

        const newFood = {
          ...food,
          price: Number(food.price),
          available: food.available !== undefined ? Boolean(food.available) : true,
          createdAt: new Date(),
        };

        const result = await foodsCollection.insertOne(newFood);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add food" });
      }
    });

    // ===========================
    // Get All Foods
    // ===========================
    app.get("/menu", async (req, res) => {
      try {
        const foods = await foodsCollection.find().toArray();
        res.send(foods);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch menu" });
      }
    });

    // ===========================
    // Get Single Food
    // ===========================
    app.get("/menu/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const food = await foodsCollection.findOne({ _id: new ObjectId(id) });

        if (!food) {
          return res.status(404).send({ message: "Food not found" });
        }

        res.send(food);
      } catch (error) {
        res.status(500).send({ message: "Invalid ID" });
      }
    });

    // ===========================
    // Update Food
    // ===========================
    app.patch("/menu/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedFood = req.body;

        const result = await foodsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedFood }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Update failed" });
      }
    });

    // ===========================
    // Delete Food
    // ===========================
    app.delete("/menu/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await foodsCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Delete failed" });
      }
    });

    // add fav
      // POST API: ফেভারিট সেভ করার জন্য
 // index.ts এ এই পরিবর্তনটি করুন

// Add Favourite
app.post("/favorite", async (req, res) => {
  try {
    const favData = req.body;

    console.log("Favourite Data:", favData);

    if (!favData.productId || !favData.userEmail) {
      return res.status(400).send({
        success: false,
        message: "Missing required fields",
      });
    }

    const query = {
      productId: favData.productId,
      userEmail: favData.userEmail,
    };

    const exists = await favoriteCollection.findOne(query);

    if (exists) {
      return res.status(409).send({
        success: false,
        message: "Already Added to Favourite",
      });
    }

    const result = await favoriteCollection.insertOne(favData);

    res.status(201).send({
      success: true,
      message: "Added Successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
  }
});


     app.get("/favorite", async (req, res) => {
      try {
        const foods = await favoriteCollection.find().toArray();
        res.send(foods);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch menu" });
      }
    });



   


  app.delete("/favorite/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await favoriteCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Delete failed" });
      }
    });

    //  add review
    app.post("/reviews", async (req, res) => {
  try {
    const { name, rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).send({ message: "Rating and comment are required" });
    }

    const newReview = {
      name: name || "Anonymous",
      rating: Number(rating),
      comment: String(comment).trim(),
      createdAt: new Date(),
    };

    const result = await reviewsCollection.insertOne(newReview);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to submit review" });
  }
});

app.get("/reviews", async (req, res) => {
  try {
    const reviews = await reviewsCollection.find().sort({ createdAt: -1 }).toArray();
    res.send(reviews);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch reviews" });
  }
});

    // ===========================
    // AI Chat — Gemini Streaming
 // ===========================
// AI Chat — Fixed & Clean
// ===========================
// AI Chat — Fixed & Clean
app.post("/chat", async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message?.trim()) {
      return res.status(400).json({ error: "userId and message required" });
    }

    // ১. ইউজার মেসেজ ডাটাবেজে সেভ করা
    await conversationsCollection.insertOne({
      userId,
      role: "user",
      content: message.trim(),
      createdAt: new Date(),
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let fullReply = "";

    try {
      // ২. সিস্টেম প্রম্পটসহ মডেল কল করা
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const chat = model.startChat({
        history: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }],
      });

      const result = await chat.sendMessageStream(message.trim());

      for await (const chunk of result.stream) {
        const token = chunk.text();
        if (token) {
          fullReply += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } catch (geminiError: any) {
      console.error("❌ Gemini API Error:", geminiError);
      fullReply = "দুঃখিত, আমি এখন ব্যস্ত আছি। কিছুক্ষণ পর আবার চেষ্টা করুন।";
      res.write(`data: ${JSON.stringify({ token: fullReply })}\n\n`);
    }

    // ৩. এসিস্ট্যান্টের উত্তর ডাটাবেজে সেভ করা
    await conversationsCollection.insertOne({
      userId,
      role: "assistant",
      content: fullReply,
      createdAt: new Date(),
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error("Chat Error:", error);
    res.end();
  }
});
// ===========================


// Get all (for admin/debug)
app.get("/chat", async (req, res) => {
  try {
    const history = await conversationsCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});



    // ===========================
    // Home Route
    // ===========================
    app.get("/", (req, res) => {
      res.send("🚀 Restaurant Backend is running perfectly!");
    });


   // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
  
//   }
// }
// run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

module.exports=app