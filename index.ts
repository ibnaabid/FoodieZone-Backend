import dotenv from "dotenv";
dotenv.config();

import express, { Application, Request, Response } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import cors from "cors";



const app: Application = express();

const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI as string;

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("🚀 Server is Running!");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");

    await client.db("admin").command({ ping: 1 });
    console.log("✅ Pinged your deployment. Successfully connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
  }
}

connectDB();

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

export default app;