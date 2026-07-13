import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, Application, NextFunction } from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import Stripe from "stripe";

const app: Application = express();
const PORT = process.env.PORT || 5000;


  const jose = require("jose-cjs");

const uri = process.env.MONGODB_URI as string;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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


    const db = client.db("Eco-world")
    const AddProducts = db.collection("addproduct");
    const FavouriteCollection = db.collection("wishlist")
    const review = db.collection("reviews")
    const ordersCollection = db.collection("buyHandy")


    // jwt

// Remote JWKS Set
const jwks = jose.createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

// --- Admin Verification Middleware ---
const adminVerify = async (
  req: any, // এখানে Request এর বদলে direct 'any' করে দেওয়া হলো
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      res.status(401).send({ success: false, message: "Unauthorized" });
      return;
    }
    


    const token = auth.split(" ")[1];

    console.log(token,"token")
    
    // টোকেন ভেরিফাই
    const { payload } = await jose.jwtVerify(token, jwks);
    
    req.user = payload; // এখন কোনো এরর ছাড়াই অ্যাসাইন হবে
    console.log("pay", payload);

    next();
  } catch (error) {
    console.error("JWT Verification Error:", error);
    res.status(401).send({ success: false, message: "Invalid Token" });
  }
};



//  add products ar jnno

    app.post("/products",async(req,res)=>{
      const body = req.body;
      const result = await AddProducts.insertOne(body)
      res.send(result)
    })

  app.get("/products",adminVerify, async (req, res) => {
  try {
    const {
      search,
      pickupAddress,
      parcelType,
      category,
      priceRange,
      sort,
    } = req.query;

    const query: any = {};

    // Search by Product Name
    if (search) {
      query.productName = {
        $regex: search,
        $options: "i",
      };
    }

    // Search by Pickup Address
    if (pickupAddress) {
      query.pickupAddress = {
        $regex: pickupAddress,
        $options: "i",
      };
    }

    // Filter by Parcel Type
    if (parcelType) {
      query.parcelType = parcelType;
    }

    // Filter by Category
    if (category) {
      query.category = category;
    }

    // Filter by Price Range
    if (priceRange) {
      const [min, max] = (priceRange as string)
        .split("-")
        .map(Number);

      query.price = {
        $gte: min,
        $lte: max,
      };
    }

    // Sort
    let sortOption: any = { _id: -1 };

    if (sort === "low") {
      sortOption = { price: 1 };
    }

    if (sort === "high") {
      sortOption = { price: -1 };
    }

    const products = await AddProducts.find(query)
      .sort(sortOption)
      .toArray();

    res.send(products);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Server Error",
    });
  }
});

// product manage korar jnno

app.patch("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = req.body;

    const result = await AddProducts.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updateData,
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Update failed" });
  }
});


app.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await AddProducts.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Delete failed" });
  }
});

// dynamic product dkhar jnno
app.get("/products/:id",adminVerify, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await AddProducts.findOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch product" });
  }
});

// fav ar jnno
app.post("/favourite", async (req, res) => {
  const favourite = req.body;

  const exists = await FavouriteCollection.findOne({
    productId: favourite.productId,
    userEmail: favourite.userEmail,
  });

  if (exists) {
    return res.send({
      message: "Already added to favourite",
    });
  }

  const result = await FavouriteCollection.insertOne(favourite);

  res.send(result);
});


 app.get("/favourite",adminVerify,async(req,res)=>{
      const result = await FavouriteCollection.find().toArray()
      res.send(result)
    })


    app.delete("/favourite/:id",adminVerify, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await FavouriteCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Delete failed" });
  }
});


// filter purpose
// GET http://localhost:5000/products

// review system ar jnno

app.get("/reviews",async(req,res)=>{
      const result = await review.find().toArray()
      res.send(result)
    })

     app.post("/reviews",async(req,res)=>{
      const body = req.body;
      const result = await review.insertOne(body)
      res.send(result)
    })

    // stripe payment



// যদি Express ব্যবহার করো তাহলে এইভাবে:

app.post("/orders", async (req: Request, res: Response) => {
      try {
        const { sessionId } = req.body;

        if (!sessionId) {
          return res.status(400).json({ error: "Session ID is required" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["line_items"],
        });

        const orderData = {
          orderId: session.metadata?.orderId || `ORD-${Date.now()}`,
          transactionId: session.id,
          customerEmail: session.customer_details?.email,
          customerName: session.customer_details?.name,
          totalAmount: session.amount_total ? session.amount_total / 100 : 0,
          currency: session.currency?.toUpperCase(),
          paymentStatus: session.payment_status,
          orderStatus: "Confirmed",
          items: session.line_items?.data.map((item: any) => ({
            productName: item.description,
            quantity: item.quantity || 1,
            price: item.amount_total ? item.amount_total / 100 : 0,
          })),
          createdAt: new Date(),
        };

        const result = await ordersCollection.insertOne(orderData);

        console.log("✅ Order Saved:", orderData.orderId);

        res.status(201).json({
          success: true,
          insertedId: result.insertedId,
          orderId: orderData.orderId,
        });
      } catch (error: any) {
        console.error("Save Order Error:", error);
        res.status(500).json({ error: error.message });
      }
    });


    app.get("/orders",async(req,res)=>{
      const body = await ordersCollection.find().toArray();
      res.send(body)
    })

     app.delete("/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ordersCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Delete failed" });
  }
});




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