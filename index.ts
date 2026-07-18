import dotenv from "dotenv";
dotenv.config();

import express, { Application, Request, Response } from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI as string;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully!");

    const db = client.db("Foddie");
    const foodsCollection = db.collection("menu");

    // ===========================
    // Add Food
    // ===========================
    app.post("/menu", async (req: Request, res: Response) => {
      try {
        const result = await foodsCollection.insertOne(req.body);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add food" });
      }
    });

    // ===========================
    // Get All Foods
    // ===========================
    app.get("/menu", async (req: Request, res: Response) => {
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
    app.get("/menu/:id", async (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: "Invalid Food ID",
          });
        }

        const food = await foodsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!food) {
          return res.status(404).send({
            message: "Food not found",
          });
        }

        res.send(food);
      } catch (error) {
        res.status(500).send({
          message: "Something went wrong",
        });
      }
    });

    // ===========================
    // Update Food
    // ===========================
    app.patch("/menu/:id", async (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;

        const result = await foodsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: req.body,
          }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Update Failed",
        });
      }
    });

    // ===========================
    // Delete Food
    // ===========================
    app.delete("/menu/:id", async (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;

        const result = await foodsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Delete Failed",
        });
      }
    });

    app.get("/", (req: Request, res: Response) => {
      res.send("🚀 Restaurant Backend is Running Perfectly!");
    });
  } catch (err) {
    console.error("❌ MongoDB Connection Failed", err);
  }
}

run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});