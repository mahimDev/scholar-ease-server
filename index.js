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
    const applicationsCollection = scholarEase.collection("applications");
    const reviewsCollection = scholarEase.collection("reviews");
    const usersCollection = scholarEase.collection("users");
    // search  role get api
    app.get("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      let role = false;
      if (user.user_role === "Modaretor") {
        role = "Modaretor";
      }
      if (user.user_role === "Admin") {
        role = "Admin";
      }
      res.send({ role });
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
    // application get api
    app.get("/application", async (req, res) => {
      const result = await applicationsCollection.find().toArray();
      res.send(result);
    });
    // reviews get api
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    // user application get api
    app.get("/application/:email", async (req, res) => {
      const email = req.params.email;

      const result = await applicationsCollection
        .aggregate([
          {
            $match: { userEmail: email },
          },
          {
            $addFields: {
              scholarshipId: { $toObjectId: "$scholarshipId" },
            },
          },
          {
            $lookup: {
              from: "scholarships",
              localField: "scholarshipId",
              foreignField: "_id",
              as: "scholarshipDetails",
            },
          },
          {
            $unwind: "$scholarshipDetails",
          },
          {
            $project: {
              _id: 1,
              address: 1,
              userEmail: 1,
              userName: 1,
              phone: 1,
              photo: 1,
              gender: 1,
              degree: 1,
              sscResult: 1,
              hscResult: 1,
              studyGap: 1,
              scholarshipName: "$scholarshipDetails.scholarshipName",
              scholarshipId: "$scholarshipDetails._id",
              universityName: "$scholarshipDetails.universityName",
              universityCountry: "$scholarshipDetails.universityCountry",
              universityCity: "$scholarshipDetails.universityCity",
              applicationFees: "$scholarshipDetails.applicationFees",
              serviceCharge: "$scholarshipDetails.serviceCharge",
              applicationDeadline: "$scholarshipDetails.applicationDeadline",
            },
          },
        ])
        .toArray();
      res.send(result);
    });
    // user can see his/her  review for this get api
    app.get("/review/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await reviewsCollection.find(query).toArray();
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
    // review add post api
    app.post("/review", async (req, res) => {
      const review = req.body;
      const query = { scholarshipId: review.scholarshipId };
      const user = await reviewsCollection.findOne(query);
      if (user) {
        return res.send({ massage: "You already gave a review" });
      }
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
    // update applications
    app.put("/application/:id", async (req, res) => {
      const id = req.params.id;
      const application = req.body;
      const query = { _id: new ObjectId(id) };
      console.log(application);
      const updatedDoc = {
        $set: {
          phone: application.phone,
          photo: application.photo,
          address: application.address,
          gender: application.gender,
          sscResult: application.sscResult,
          hscResult: application.hscResult,
          degree: application.degree,
          studyGap: application.studyGap,
        },
      };
      const result = await applicationsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
    // update scholarships
    app.put("/scholarship/:id", async (req, res) => {
      const id = req.params.id;
      const scholarship = req.body;
      const query = { _id: new ObjectId(id) };
      console.log(scholarship);
      const updatedDoc = {
        $set: {
          scholarshipName: scholarship.scholarshipName,
          universityName: scholarship.universityName,
          universityImage: scholarship.photo,
          universityCountry: scholarship.universityCountry,
          universityCity: scholarship.universityCity,
          subjectCategory: scholarship.subjectCategory,
          scholarshipCategory: scholarship.scholarshipCategory,
          degree: scholarship.degree,
          tuitionFees: scholarship.tuitionFees,
          applicationFees: scholarship.applicationFees,
          serviceCharge: scholarship.serviceCharge,
          applicationDeadline: scholarship.applicationDeadline,
          postedUserEmail: scholarship.postedUserEmail,
        },
      };
      const result = await scholarshipsCollection.updateOne(query, updatedDoc);
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
    // update review patch api
    app.patch("/review", async (req, res) => {
      const { rating, comment, id } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          rating: rating,
          comment: comment,
        },
      };
      const result = await reviewsCollection.updateOne(query, updateUser);
      res.send(result);
    });
    // user delete api
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    // applications cancel delete api
    app.delete("/application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicationsCollection.deleteOne(query);
      res.send(result);
    });
    // scholarship  delete api
    app.delete("/scholarship/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await scholarshipsCollection.deleteOne(query);
      res.send(result);
    });
    // cancel review delete api
    app.delete("/review/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
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
