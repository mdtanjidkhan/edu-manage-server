const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion} = require('mongodb');
const PORT = process.env.PORT
app.use(cors());
app.use(express.json());
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
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
    const attendanceCollection = db.collection("attendance");
    const teacherAttendanceCollection = db.collection("teacherAttendance");
    const feesCollection = db.collection("fees");
    const settingsCollection = db.collection("settings");
    const noticeCollection = db.collection("notices");
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

    // 🚀 TASK 1.2: GET ALL STUDENTS
// ==========================================
app.get('/api/admin/students', async (req, res) => {
  try {
    // শুধুমাত্র role: "student" ফিল্টার করে ডাটা নেওয়া
    const students = await usersCollection
      .find({ role: "student" })
      .project({ password: 0 }) // সিকিউরিটির জন্য পাসওয়ার্ড বাদ দেওয়া হয়েছে
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      students
    });
  } catch (error) {
    console.error("Fetch Students Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch students" });
  }
});

// ==========================================
// 🚀 TASK 1.2: ADD NEW STUDENT (POST)
// ==========================================
app.post('/api/admin/students', async (req, res) => {
  try {
    const { name, email, password, studentId, department } = req.body;

    // ১. ফিল্ড ভ্যালিডেশন
    if (!name || !email || !password || !studentId || !department) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields (name, email, password, studentId, department) are required." 
      });
    }

    // ২. ইমেইল বা স্টুডেন্ট আইডি আগে থেকেই আছে কি না তা চেক করা
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, { studentId }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Student with this Email or Student ID already exists."
      });
    }

    // ৩. পাসওয়ার্ড হ্যাশ করা (Better Auth Compatible)
    const hashedPassword = await bcrypt.hash(password, 10);

    // ৪. নতুন স্টুডেন্ট ডাটা তৈরি
    const newStudent = {
      name,
      email,
      password: hashedPassword,
      role: "student",
      studentId,
      department,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // ৫. ডাটাবেজে ইনসার্ট
    const result = await usersCollection.insertOne(newStudent);

    res.status(201).json({
      success: true,
      message: "Student added successfully!",
      studentId: result.insertedId
    });

  } catch (error) {
    console.error("Add Student Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ==========================================
// 🚀 TASK 1.2: UPDATE STUDENT (PUT)
// ==========================================
app.put('/api/admin/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, studentId, department } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Student ID format" });
    }

    const updatedData = {
      name,
      email,
      studentId,
      department,
      updatedAt: new Date()
    };

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id), role: "student" },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({
      success: true,
      message: "Student details updated successfully!"
    });
  } catch (error) {
    console.error("Update Student Error:", error);
    res.status(500).json({ success: false, message: "Failed to update student" });
  }
});

// ==========================================
// 🚀 TASK 1.2: DELETE STUDENT (DELETE)
// ==========================================
app.delete('/api/admin/students/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Student ID format" });
    }

    const result = await usersCollection.deleteOne({ _id: new ObjectId(id), role: "student" });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.status(200).json({
      success: true,
      message: "Student deleted successfully!"
    });
  } catch (error) {
    console.error("Delete Student Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete student" });
  }
});


// ==========================================
// 🚀 TASK 1.3: GET ALL TEACHERS
// ==========================================
app.get('/api/admin/teachers', async (req, res) => {
  try {
    const teachers = await usersCollection
      .find({ role: "teacher" })
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, teachers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch teachers" });
  }
});

// ==========================================
// 🚀 TASK 1.3: ADD NEW TEACHER (POST)
// ==========================================
app.post('/api/admin/teachers', async (req, res) => {
  try {
    const { name, email, password, designation, department } = req.body;

    if (!name || !email || !password || !designation || !department) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required." 
      });
    }

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newTeacher = {
      name,
      email,
      password: hashedPassword,
      role: "teacher",
      designation,
      department,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(newTeacher);

    res.status(201).json({
      success: true,
      message: "Teacher added successfully!",
      teacherId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ==========================================
// 🚀 TASK 1.3: UPDATE TEACHER (PUT)
// ==========================================
app.put('/api/admin/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, designation, department } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Teacher ID" });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id), role: "teacher" },
      { $set: { name, email, designation, department, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    res.status(200).json({ success: true, message: "Teacher details updated!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update teacher" });
  }
});

// ==========================================
// 🚀 TASK 1.3: DELETE TEACHER (DELETE)
// ==========================================
app.delete('/api/admin/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Teacher ID" });
    }

    const result = await usersCollection.deleteOne({ _id: new ObjectId(id), role: "teacher" });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    res.status(200).json({ success: true, message: "Teacher deleted successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete teacher" });
  }
});

// ==========================================
// 🚀 TASK 1.4: GET ALL USERS FOR ROLE & STATUS MANAGEMENT
// ==========================================
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await usersCollection
      .find({})
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// ==========================================
// 🚀 TASK 1.4: UPDATE USER ROLE & STATUS (PATCH)
// ==========================================
app.patch('/api/admin/users/:id/access', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid User ID" });
    }

    const updateDoc = {};
    if (role) updateDoc.role = role;
    if (status) updateDoc.status = status; // 'active' or 'blocked'
    updateDoc.updatedAt = new Date();

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ 
      success: true, 
      message: "User role and status updated successfully!" 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user access" });
  }
});

// ==========================================
// 1.5 STUDENT ATTENDANCE REPORT API (GET)
// ==========================================
app.get('/api/admin/attendance/students', async (req, res) => {
  try {
    const { date, department } = req.query;

    let query = {};
    if (date) {
      query.date = date; // Format: YYYY-MM-DD
    }
    if (department && department !== "All") {
      query.department = department;
    }

    const records = await attendanceCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch student attendance records" });
  }
});

// ==========================================
// 2. TEACHER ATTENDANCE REPORT API (GET)
// ==========================================
app.get('/api/admin/attendance/teachers', async (req, res) => {
  try {
    const { date, department } = req.query;

    let query = {};
    if (date) {
      query.date = date; // Format: YYYY-MM-DD
    }
    if (department && department !== "All") {
      query.department = department;
    }

    // teacherAttendanceCollection থেকে ডাটা আনা হবে
    const records = await teacherAttendanceCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch teacher attendance records" });
  }
});



// ==========================================
// 1.6 GET ALL FEES / PAYMENT RECORDS
// ==========================================
app.get('/api/admin/fees', async (req, res) => {
  try {
    const { department, status, search } = req.query;

    let query = {};
    if (department && department !== "All") {
      query.department = department;
    }
    if (status && status !== "All") {
      query.status = status; // "Paid" or "Pending"
    }
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } }
      ];
    }

    const records = await feesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch fee records" });
  }
});

// ==========================================
// 2. UPDATE FEE STATUS (COLLECT PAYMENT)
// ==========================================
app.patch('/api/admin/fees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod } = req.body;

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        status: status, // "Paid"
        paymentMethod: paymentMethod || "Cash",
        paidAt: new Date().toISOString().split("T")[0]
      }
    };

    const result = await feesCollection.updateOne(filter, updateDoc);
    res.status(200).json({ success: true, message: "Fee payment updated successfully!", result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update fee record" });
  }
});

// 1. GET SYSTEM SETTINGS & ANALYTICS
// ==========================================
app.get('/api/admin/settings', async (req, res) => {
  try {
    const settings = await settingsCollection.findOne({ type: "general_config" });
    
    // Quick Stats Calculation
    const totalUsers = await usersCollection.countDocuments({});
    const totalStudents = await usersCollection.countDocuments({ role: 'student' });
    const totalTeachers = await usersCollection.countDocuments({ role: 'teacher' });
    const blockedUsers = await usersCollection.countDocuments({ status: 'blocked' });

    res.status(200).json({
      success: true,
      settings: settings || {
        instituteName: "Polytechnic Institute of Technology",
        academicYear: "2026-2027",
        allowSelfSignup: true,
        maintenanceMode: false,
      },
      stats: { totalUsers, totalStudents, totalTeachers, blockedUsers }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch settings" });
  }
});

// ==========================================
// 2. UPDATE SYSTEM SETTINGS (PUT)
// ==========================================
app.put('/api/admin/settings', async (req, res) => {
  try {
    const { instituteName, academicYear, allowSelfSignup, maintenanceMode } = req.body;

    const filter = { type: "general_config" };
    const updateDoc = {
      $set: {
        type: "general_config",
        instituteName,
        academicYear,
        allowSelfSignup,
        maintenanceMode,
        updatedAt: new Date()
      }
    };
    await settingsCollection.updateOne(filter, updateDoc, { upsert: true });
    res.status(200).json({ success: true, message: "Settings updated successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update settings" });
  }
});

// GET: সকল নোটিশ দেখা (Student & Teacher Dashboard-এর জন্য)
app.get('/api/notices', async (req, res) => {
  try {
    const { target } = req.query; // e.g. /api/notices?target=Students
    let query = {};

    // স্টুডেন্ট বা টিচার ফিল্টার অনুযায়ী নোটিশ আনা
    if (target) {
      query = { targetAudience: { $in: ["All", target] } };
    }

    const notices = await noticeCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, notices });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch notices" });
  }
});
// POST: নতুন নোটিশ তৈরি করা (Admin Only)
app.post('/api/admin/notices', async (req, res) => {
  try {
    const { title, description, targetAudience, category } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title and description required" });
    }

    const newNotice = {
      title,
      description,
      targetAudience: targetAudience || "All", // "All", "Students", "Teachers"
      category: category || "General",
      date: new Date().toISOString().split("T")[0],
      createdAt: new Date()
    };

    const result = await noticeCollection.insertOne(newNotice);
    res.status(201).json({ success: true, message: "Notice created successfully", result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create notice" });
  }
});

// PATCH / PUT: নোটিশ আপডেট করা (Admin Only)
app.patch('/api/admin/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const result = await noticeCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.status(200).json({ success: true, message: "Notice updated successfully", result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notice" });
  }
});

// DELETE: নোটিশ ডিলিট করা (Admin Only)
app.delete('/api/admin/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await noticeCollection.deleteOne({ _id: new ObjectId(id) });

    res.status(200).json({ success: true, message: "Notice deleted successfully", result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete notice" });
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