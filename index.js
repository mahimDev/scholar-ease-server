require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// middlware
const verifyToken = (req, res, next) => {
  if (!req.headers.authorizetion) {
    return res.status(401).send({ massage: "unauthorized access" });
  }
  const token = req.headers.authorizetion.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (error, decoded) => {
    if (error) {
      return res.status(401).send({ massage: "unauthorized access" });
    }
    req.decoded = decoded;

    next();
  });
};
// use verify admin
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { user_email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.user_role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};
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
    // await client.connect();
    const scholarEase = client.db("scholarEase");
    const scholarshipsCollection = scholarEase.collection("scholarships");
    const applicationsCollection = scholarEase.collection("applications");
    const reviewsCollection = scholarEase.collection("reviews");
    const usersCollection = scholarEase.collection("users");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    app.get("/admin-stats", async (req, res) => {
      const user = await usersCollection.estimatedDocumentCount();
      const application = await applicationsCollection.estimatedDocumentCount();
      const scholarship = await scholarshipsCollection.estimatedDocumentCount();
      const review = await reviewsCollection.estimatedDocumentCount();
      res.send({
        user,
        review,
        application,
        scholarship,
      });
    });
    // search  role get api
    app.get("/user/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }
      if (email !== req.decoded.email) {
        return res.status(403).send({ massage: "forbidden access" });
      }
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      let role;
      if (user?.user_role === "Admin") {
        role = "Admin";
      }
      if (user?.user_role === "Modaretor") {
        role = "Modaretor";
      }
      if (user?.user_role === "user") {
        role = "RegularUser";
      }
      res.send({ role });
    });
    app.get("/featuredScholarship", async (req, res) => {
      const result = await scholarshipsCollection
        .aggregate([
          {
            $addFields: {
              applicationFeesNumeric: {
                $toInt: "$applicationFees", // Convert applicationFees to a number
              },
              postedDate: {
                $toDate: "$_id",
              },
            },
          },
          {
            $sort: {
              applicationFeesNumeric: 1,
              postedDate: -1,
            },
          },
          {
            $limit: 6,
          },
        ])
        .toArray();
      res.send(result);
    });
    // scholarships get api
    app.get("/scholarships", async (req, res) => {
      const result = await scholarshipsCollection.find().toArray();
      res.send(result);
    });
    // scholarship by search
    app.get("/scholarship", async (req, res) => {
      const { sorting, search, page = 1, limit = 6 } = req.query;
      const totalitems = await scholarshipsCollection.countDocuments();
      let sortValue = {};
      if (sorting === "asc") sortValue = { applicationFees: 1 };
      if (sorting === "des") sortValue = { applicationFees: -1 };
      let query = {};
      if (search) {
        query = {
          $or: [
            {
              universityName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              degree: {
                $regex: search,
                $options: "i",
              },
            },
            {
              scholarshipName: {
                $regex: search,
                $options: "i",
              },
            },
          ],
        };
      }
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
      console.log(sorting);

      const result = await scholarshipsCollection
        .find(query)
        .sort(sortValue)
        .skip(skip)
        .limit(limitNumber)
        .toArray();
      res.send({ result, totalitems });
    });
    //
    // app.get("/scholarship", async (req, res) => {
    //   try {
    //     const {
    //       sorting,
    //       search,
    //       page = 1,
    //       limit = 6,
    //       sortBy = "applicationFees",
    //     } = req.query;

    //     // Convert page and limit to numbers
    //     const pageNumber = parseInt(page);
    //     const limitNumber = parseInt(limit);
    //     const skip = (pageNumber - 1) * limitNumber;

    //     // Sorting logic
    //     let sortValue = {};
    //     if (sorting === "asc") sortValue[sortBy] = 1;
    //     if (sorting === "des") sortValue[sortBy] = -1;

    //     // Search logic
    //     let query = {};
    //     if (search) {
    //       query = {
    //         $or: [
    //           { universityName: { $regex: search, $options: "i" } },
    //           { degree: { $regex: search, $options: "i" } },
    //           { scholarshipName: { $regex: search, $options: "i" } },
    //         ],
    //       };
    //     }

    //     // Get total items count
    //     const totalitems = await scholarshipsCollection.countDocuments(query);

    //     // Fetch results
    //     const result = await scholarshipsCollection
    //       .find(query)
    //       .sort(sortValue)
    //       .skip(skip)
    //       .limit(limitNumber)
    //       .toArray();

    //     res.send({ result, totalitems });
    //   } catch (error) {
    //     console.error("Error fetching scholarships:", error);
    //     res.status(500).send({ message: "Server error" });
    //   }
    // });
    //
    // all users get api
    app.get("/users", verifyToken, async (req, res) => {
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
      const query = { scholarshipId: id };
      const reviwes = await reviewsCollection.find(query).toArray();
      const filter = { _id: new ObjectId(id) };
      const scholarship = await scholarshipsCollection.findOne(filter);
      const result = {
        scholarship,
        reviwes,
      };
      res.send(result);
    });
    // application get api
    app.get("/application", verifyToken, async (req, res) => {
      const { sort } = req.query;
      let sortOption = { _id: 1 };
      if (sort === "appliedDate") {
        sortOption = { applicationDeadline: 1 };
      }
      if (sort === "scholarshipDeadline") {
        sortOption = { postdDate: 1 };
      }

      const result = await applicationsCollection
        .aggregate([
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
              userEmail: 1,
              userName: 1,
              phone: 1,
              photo: 1,
              degree: 1,
              sscResult: 1,
              hscResult: 1,
              studyGap: 1,
              status: 1,
              universityName: "$scholarshipDetails.universityName",
              applicationDeadline: "$scholarshipDetails.applicationDeadline",
              postdDate: "$scholarshipDetails.postdDate",
            },
          },
          {
            $sort: sortOption,
          },
        ])
        .toArray();
      res.send(result);
    });
    // reviews get api
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    // user application get api
    app.get("/application/:email", verifyToken, async (req, res) => {
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
              feedback: 1,
              status: 1,
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
      const query = { applicationId: review.applicationId };
      const user = await reviewsCollection.findOne(query);
      if (user) {
        return res.send({ massage: "You already gave a review" });
      }
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
    // update applications
    app.put("/application/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const application = req.body;
      const query = { _id: new ObjectId(id) };
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
    app.put("/scholarship/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const scholarship = req.body;
      const query = { _id: new ObjectId(id) };
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
    app.patch("/user", verifyToken, async (req, res) => {
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
    app.patch("/review", verifyToken, async (req, res) => {
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
    // update feedback patch api
    app.patch("/application", verifyToken, async (req, res) => {
      const { feedback, id } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await applicationsCollection.updateOne(query, updateUser);
      res.send(result);
    });
    // Applications rejected patch api
    app.patch("/application/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) };

      const updateUser = {
        $set: {
          status: status,
        },
      };
      const result = await applicationsCollection.updateOne(query, updateUser);
      res.send(result);
    });
    // user delete api
    app.delete("/user/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    // applications cancel delete api
    app.delete("/application/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicationsCollection.deleteOne(query);
      res.send(result);
    });
    // scholarship  delete api
    app.delete("/scholarship/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await scholarshipsCollection.deleteOne(query);
      res.send(result);
    });
    // cancel review delete api
    app.delete("/review/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  // console.log("scholar is available", port);
});
