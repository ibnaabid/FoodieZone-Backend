import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion } from "mongodb";

const app = express();

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI as string;

app.use(cors());
app.use(express.json());


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

    await client.db("admin").command({ ping: 1 });

    console.log("✅ MongoDB Connected");

    app.get("/", (req: Request, res: Response) => {
      res.send("🚀 Eco World Backend Running");
    });





    

    app.listen(PORT, () => {
      console.log(`🚀 Server Running http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
}

run();