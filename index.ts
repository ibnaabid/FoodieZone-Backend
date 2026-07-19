// index.ts
import dotenv from "dotenv";
dotenv.config();

import express, { Application } from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

import OpenAI from "openai";

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "https://foodiezone-nu.vercel.app",
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


console.log(
  "🔑 OPENROUTER_API_KEY loaded:",
  process.env.OPENROUTER_API_KEY
    ? `Yes (starts with ${process.env.OPENROUTER_API_KEY.slice(0, 6)}...)`
    : "❌ NO — missing!"
);

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://foodiezone-nu.vercel.app",
    "X-Title": "CravingByte",
  },
});

const MODEL = "meta-llama/llama-3.3-70b-instruct:free";

const SYSTEM_PROMPT = `You are CravingByte's AI assistant — a friendly food ordering app assistant.
You help users find dishes, understand categories, track orders, and navigate the app.
Keep answers short, warm, and practical. If asked something outside food/ordering context, gently redirect.`;




 client.connect();
console.log("MongoDB Connected");

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
// ===========================
// AI Chat — Gemini Streaming + Role Support
// ===========================
// ===========================
// AI Chat — Gemini Streaming + Role Support
// ===========================
// ===========================
// AI Chat — Gemini Streaming + Role Support (Clean & Fixed)
// ===========================
// ===========================
// AI Chat — Gemini Streaming + Role Support (Fixed)
// ===========================
    app.post("/chat", async (req, res) => {
    try {
      const { userId, role, message } = req.body;

      if (!userId || !message) {
        return res.status(400).json({ error: "userId and message are required" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const prevMessages = await conversations
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      prevMessages.reverse();

      const roleContext =
        role === "restaurant"
          ? "The user is a restaurant owner managing their menu and orders."
          : "The user is a customer browsing food and placing orders.";

      const chatMessages = [
        { role: "system" as const, content: `${SYSTEM_PROMPT}\n${roleContext}` },
        ...prevMessages.map((m: any) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
        { role: "user" as const, content: message },
      ];

      await conversations.insertOne({
        userId,
        role: "user",
        content: message,
        createdAt: new Date(),
      });

      const stream = await openrouter.chat.completions.create({
        model: MODEL,
        messages: chatMessages,
        stream: true,
        temperature: 0.7,
      });

      let fullReply = "";
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";
        if (token) {
          fullReply += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }

      let suggestions: string[] = [];
      try {
        const suggestionRes = await openrouter.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "Suggest 3 short, natural follow-up questions the user might ask next based on this reply. Reply ONLY with a JSON array of 3 strings, nothing else.",
            },
            { role: "user", content: fullReply },
          ],
          temperature: 0.5,
        });
        suggestions = JSON.parse(suggestionRes.choices[0].message.content || "[]");
      } catch {
        suggestions = [];
      }

      await conversations.insertOne({
        userId,
        role: "assistant",
        content: fullReply,
        createdAt: new Date(),
      });

      res.write(`data: ${JSON.stringify({ done: true, suggestions })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Chat error:", error);
      res.write(`data: ${JSON.stringify({ error: "Something went wrong." })}\n\n`);
      res.end();
    }
  });

  app.get("/chat/:userId", async (req, res) => {
    try {
      const history = await conversations
        .find({ userId: req.params.userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.get("/chat", async (req, res) => {
    try {
      const history = await conversations.find().sort({ createdAt: -1 }).limit(10).toArray();
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