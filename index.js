const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion} = require('mongodb');
const PORT = process.env.PORT
app.use(cors());
app.use(express.json());
const uri = process.env.MONGODB_SERVER_URL;

app.get('/', (req, res) => {
  res.send('EduManage Express Server Running!')
})

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    const db = client.db("edumanage"); 
    const usersCollection = db.collection("user"); 

    // ==========================================
    // 🚀 TASK 1.1: ADMIN STATS API
    // ==========================================
    app.get('/api/admin/stats', async (req, res) => {
      try {
        // ডাটাবেজ থেকে রিয়েল কাউন্ট
        const totalStudents = await usersCollection.countDocuments({ role: "student" });
        const totalTeachers = await usersCollection.countDocuments({ role: "teacher" });
        
        // ডামি ডাটা (পরবর্তীতে রিয়েল টেবিল থেকে ক্যালকুলেট হবে)
        const totalFees = 45000; 
        const attendancePercentage = "92%";

        res.status(200).json({
          success: true,
          stats: {
            totalStudents,
            totalTeachers,
            totalFees,
            attendancePercentage
          }
        });
      } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`🚀 EduManage server running on port ${PORT}`);
});