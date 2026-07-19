// index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { Application } from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

const uri = process.env.MONGODB_URI || "";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

console.log("🔑 GEMINI_API_KEY loaded:", process.env.GEMINI_API_KEY ? `Yes (starts with ${process.env.GEMINI_API_KEY.slice(0, 6)}...)` : "❌ NO — missing!");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `You are CravingByte's AI assistant — a friendly food ordering app assistant.
You help users find dishes, understand categories, track orders, and navigate the app.
Keep answers short, warm, and practical. If asked something outside food/ordering context, gently redirect.`;

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");

    const db = client.db("Foddie");
    const foodsCollection = db.collection("menu");
    const conversations = db.collection("conversations");
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
    app.post("/chat", async (req, res) => {
      try {
        const { userId, message, conversationId } = req.body;

        if (!userId || typeof message !== "string" || !message.trim()) {
          return res.status(400).json({ error: "userId and a non-empty message are required" });
        }

        const trimmedMessage = message.trim();

        let conversation;
        let convId = conversationId;

        if (convId && ObjectId.isValid(convId)) {
          conversation = await conversations.findOne({ _id: new ObjectId(convId) });
        }

        if (!conversation) {
          const result = await conversations.insertOne({
            userId,
            messages: [],
            createdAt: new Date(),
          });
          convId = result.insertedId.toString();
          conversation = { _id: result.insertedId, messages: [] };
        }

        const history = conversation.messages || [];

        // Gemini history format: role "model" (assistant na), first message user howa lagbe
        const geminiHistory = history.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          systemInstruction: SYSTEM_PROMPT,
        });

        // SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        res.write(`data: ${JSON.stringify({ type: "meta", conversationId: convId })}\n\n`);

        console.log("📤 Calling Gemini with history length:", geminiHistory.length);

        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessageStream(trimmedMessage);

        let fullReply = "";

        for await (const chunk of result.stream) {
          const token = chunk.text();
          if (token) {
            fullReply += token;
            res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
          }
        }

        console.log("✅ Full reply received:", fullReply.slice(0, 100));

        await conversations.updateOne(
          { _id: new ObjectId(convId) },
          {
            $push: {
              messages: {
                $each: [
                  { role: "user", content: trimmedMessage, createdAt: new Date() },
                  { role: "assistant", content: fullReply, createdAt: new Date() },
                ],
              },
            } as any,
          }
        );

        // Follow-up suggestions
        let suggestions: string[] = [];

        if (fullReply.trim()) {
          try {
            const suggestionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const suggestionResult = await suggestionModel.generateContent(
              `Based on this conversation, suggest exactly 3 short follow-up questions the user might ask next. Return ONLY a JSON array of 3 strings, nothing else, no markdown.\n\nUser asked: "${trimmedMessage}"\nAssistant replied: "${fullReply}"`
            );

            const raw = suggestionResult.response.text();
            suggestions = JSON.parse(raw.replace(/```json|```/g, "").trim());
          } catch (suggestionError) {
            console.error("Suggestion generation failed:", suggestionError);
            suggestions = [];
          }
        }

        res.write(`data: ${JSON.stringify({ type: "suggestions", suggestions })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } catch (error: any) {
        console.error("========================================");
        console.error("❌ CHAT ERROR DETAILS");
        console.error("Message:", error?.message);
        console.error("Status:", error?.status);
        console.error("Full error:", error);
        console.error("========================================");

        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to process chat" });
        } else {
          res.write(`data: ${JSON.stringify({ type: "error", message: "Something went wrong" })}\n\n`);
          res.end();
        }
      }
    });

    // ===========================
    // Get conversation history (single user)
    // ===========================
    app.get("/chat/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const history = await conversations
          .find({ userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray();

        res.json(history);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch history" });
      }
    });

    // ===========================
    // Get all conversations (debug/admin)
    // ===========================
    app.get("/chat", async (req, res) => {
      try {
        const history = await conversations
          .find()
          .sort({ createdAt: -1 })
          .limit(10)
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

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Connection failed", err);
  }
}

run().catch(console.dir);