require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@practice.hcuo4.mongodb.net/?retryWrites=true&w=majority&appName=practice`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const scholarEase = client.db("scholarEase");
    const scholarshipsCollection = scholarEase.collection("scholarships");
    const usersCollection = scholarEase.collection("users");
    const applicationsCollection = scholarEase.collection("applications");
    // search admin role get api
    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.user_role === "Admin";
      }
      res.send({ admin });
    });
    // scholarships get api
    app.get("/scholarship", async (req, res) => {
      const result = await scholarshipsCollection.find().toArray();
      res.send(result);
    });
    // all users get api
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // get single user api
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    // single scholarship get api
    app.get("/scholarship/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await scholarshipsCollection.findOne(query);
      res.send(result);
    });
    // payment related post api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //add scholarship post api
    app.post("/scholarship", async (req, res) => {
      const data = req.body;
      const result = await scholarshipsCollection.insertOne(data);
      res.send(result);
    });
    // add user post api
    app.post("/user", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // add application post api
    app.post("/application", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });
    // update user role patch api
    app.patch("/user", async (req, res) => {
      const { role, id } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          user_role: role,
        },
      };
      const result = await usersCollection.updateOne(query, updateUser);
      res.send(result);
    });
    // user delete api
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("scholar is available", port);
});
