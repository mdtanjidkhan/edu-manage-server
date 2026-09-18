const express = require('express');
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion} = require('mongodb');
const PORT = process.env.PORT
app.use(cors());
app.use(express.json());
const { auth } = require("./lib/auth");
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
    const routineCollection = db.collection("routine");
    const marksCollection = db.collection("marks");
    const assignmentsCollection = db.collection("assignments");
    const submissionsCollection = db.collection("submissions");
    const paymentsCollection = db.collection("payments");


    // 🚀 TASK 1.1: ADMIN STATS API
    app.get('/api/admin/stats', async (req, res) => {
      try {
       
        const totalStudents = await usersCollection.countDocuments({ role: "student" });
        const totalTeachers = await usersCollection.countDocuments({ role: "teacher" });
        
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


 // ==========================================
// 🚀 TASK 1.2: GET ALL STUDENTS

app.get('/api/admin/students', async (req, res) => {
  try {
    const { classId } = req.query; 
    const query = { role: "student" };

    if (classId) {
      query.$or = [
        { classId: classId },
        { class: classId }
      ];
    }

    const students = await usersCollection
      .find(query)
      .project({ password: 0 }) 
      .sort({ roll: 1, createdAt: -1 }) 
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


// 🚀 TASK 1.2: ADD NEW STUDENT (POST)
app.post('/api/admin/students', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      studentId,
      class: className,
      group,
    } = req.body;

    // Validation
    if (!name || !email || !password || !studentId || !className) {
      return res.status(400).json({
        success: false,
        message:
          "All required fields (name, email, password, studentId, class) must be provided.",
      });
    }

    // Check existing student information
    const existingStudent = await usersCollection.findOne({
      $or: [{ email }, { studentId }],
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student with this Email or Student ID already exists.",
      });
    }

    // Create Better Auth account
    const result = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });

    if (!result?.user) {
      return res.status(500).json({
        success: false,
        message: "Failed to create student account.",
      });
    }

    // Update Better Auth user with student information
    await usersCollection.updateOne(
      { _id: new ObjectId(result.user.id) },
      {
        $set: {
          role: "student",
          studentId,
          class: className,
          group: group || "General",
          emailVerified: false,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(201).json({
      success: true,
      message: "Student account created successfully!",
      student: {
        id: result.user.id,
        name,
        email,
        role: "student",
        studentId,
        class: className,
        group: group || "General",
      },
    });
  } catch (error) {
    console.error("Add Student Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});


// ==========================================
// 🚀 TASK 1.2: UPDATE STUDENT (PUT)
// ==========================================
app.put('/api/admin/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, studentId, class: className, group } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Student ID format" });
    }

    const updatedData = {
      name,
      email,
      studentId,
      class: className,
      group: group || "General",
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

//  TASK 1.3: GET ALL TEACHERS

app.get('/api/admin/teachers', async (req, res) => {
  try {
    const teachers = await usersCollection
      .find({ role: "teacher" })
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, teachers });
  } catch (error) {
    console.error("Fetch Teachers Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch teachers" });
  }
});


//  TASK 1.3: ADD NEW TEACHER (POST)
// 1. POST: Create New Teacher
app.post('/api/admin/teachers', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      designation,
      subject
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }

    // Check existing user
    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Create Better Auth user
    const authResult = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password
      }
    });

    if (!authResult?.user) {
      return res.status(400).json({
        success: false,
        message: "Failed to create teacher account"
      });
    }

    // Add teacher-specific information
    await usersCollection.updateOne(
      { _id: new ObjectId(authResult.user.id) },
      {
        $set: {
          role: "teacher",
          designation: designation || "Assistant Teacher",
          subject: subject || "Mathematics",
          emailVerified: false,
          updatedAt: new Date()
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      teacherId: authResult.user.id
    });

  } catch (error) {
    console.error("Error creating teacher:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create teacher"
    });
  }
});

// 2. PUT: Update Teacher Details
app.put('/api/admin/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, designation, subject } = req.body;

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        name,
        email,
        designation: designation || "Assistant Teacher",
        subject: subject || "Mathematics",
        updatedAt: new Date()
      }
    };

    const result = await usersCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    res.status(200).json({ success: true, message: "Teacher updated successfully" });
  } catch (error) {
    console.error("Error updating teacher:", error);
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
    console.error("Delete Teacher Error:", error);
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
// 1. STUDENT ATTENDANCE REPORT API (GET)
// ==========================================
app.get('/api/admin/attendance/students', async (req, res) => {
  try {
    const { date, subject } = req.query;

    let query = {};
    if (date) {
      query.date = date; // Format: YYYY-MM-DD
    }
    // department এর পরিবর্তে subject দিয়ে ফিল্টার
    if (subject && subject !== "All") {
      query.subjectName = subject; // অথবা আপনার স্কিমা অনুযায়ী query.subject
    }

    const records = await attendanceCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, records });
  } catch (error) {
    console.error("Student attendance fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch student attendance records" });
  }
});




// ==========================================
// 2. TEACHER ATTENDANCE REPORT API (GET)
// ==========================================

app.get('/api/admin/attendance/teachers', async (req, res) => {
  try {
    const { date, subject } = req.query;

    let query = {};
    if (date) {
      query.date = date; // Format: YYYY-MM-DD
    }
    if (subject && subject !== "All") {
      query.subject = subject;
    }

    const records = await teacherAttendanceCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, records });
  } catch (error) {
    console.error("Teacher attendance fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch teacher attendance records" });
  }
});


// 1. POST: Create New Routine Entry

// POST: Create Routine with Overlap Check (Task 2.4)

app.post('/api/admin/routine', async (req, res) => {
  try {
    const { teacherId, teacherName, day, subjectName, classId, group, startTime, endTime, roomNo } = req.body;

    if (!day || !subjectName || !classId || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "Required routine fields missing" });
    }

    if (roomNo && roomNo !== "N/A") {
      const roomConflict = await routineCollection.findOne({
        day: day,
        roomNo: roomNo,
        $or: [
          { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
        ]
      });

      if (roomConflict) {
        return res.status(400).json({
          success: false,
          message: `Room ${roomNo} is already booked for ${roomConflict.subjectName} on ${day} (${roomConflict.startTime} - ${roomConflict.endTime})`
        });
      }
    }
    if (teacherId) {
      const teacherConflict = await routineCollection.findOne({
        day: day,
        teacherId: teacherId,
        $or: [
          { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
        ]
      });

      if (teacherConflict) {
        return res.status(400).json({
          success: false,
          message: `Teacher (${teacherName || teacherId}) already has a class in Room ${teacherConflict.roomNo} at this time (${teacherConflict.startTime} - ${teacherConflict.endTime})!`
        });
      }
    }
    const newRoutine = {
      teacherId: teacherId || "",
      teacherName: teacherName || "Unassigned",
      day,
      subjectName,
      classId,
      group: group || "General",
      startTime,
      endTime,
      roomNo: roomNo || "N/A",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await routineCollection.insertOne(newRoutine);
    res.status(201).json({ success: true, message: "Routine created successfully", insertedId: result.insertedId });

  } catch (error) {
    console.error("Error creating routine:", error);
    res.status(500).json({ success: false, message: "Failed to create routine" });
  }
});


// 2. GET: Get All Routines (Admin View)

app.get('/api/admin/routine', async (req, res) => {
  try {
    const { classId, day } = req.query;
    let query = {};

    if (classId && classId !== "All") query.classId = classId;
    if (day && day !== "All") query.day = day;

    const routines = await routineCollection
      .find(query)
      .sort({ day: 1, startTime: 1 })
      .toArray();

    res.status(200).json({ success: true, routines });
  } catch (error) {
    console.error("Error fetching routines:", error);
    res.status(500).json({ success: false, message: "Failed to fetch routines" });
  }
});


// 3. PUT: Update Routine Entry
app.put('/api/admin/routine/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId, teacherName, day, subjectName, classId, group, startTime, endTime, roomNo } = req.body;

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        teacherId,
        teacherName,
        day,
        subjectName,
        classId,
        group: group || "General",
        startTime,
        endTime,
        roomNo,
        updatedAt: new Date()
      }
    };

    const result = await routineCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Routine entry not found" });
    }

    res.status(200).json({ success: true, message: "Routine updated successfully" });
  } catch (error) {
    console.error("Error updating routine:", error);
    res.status(500).json({ success: false, message: "Failed to update routine" });
  }
});


// 4. DELETE: Remove Routine Entry
app.delete('/api/admin/routine/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await routineCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Routine entry not found" });
    }

    res.status(200).json({ success: true, message: "Routine deleted successfully" });
  } catch (error) {
    console.error("Error deleting routine:", error);
    res.status(500).json({ success: false, message: "Failed to delete routine" });
  }
});


// ==========================================
// ADMIN FEES & PAYMENT MANAGEMENT APIs
// ==========================================

// ১. POST: নতুন ফি ক্রিয়েট করা
app.post("/api/admin/fees", async (req, res) => {
  try {
    const { title, category, className, group, amount, dueDate } = req.body;

    if (!title || !category || !className || !amount || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "সবগুলো ফিল্ড দেওয়া আবশ্যক"
      });
    }

    const newFee = {
      title,
      category,
      className,
      group: (className === 'Class 9' || className === 'Class 10') ? (group || 'All') : 'General',
      amount: Number(amount),
      dueDate,
      createdAt: new Date()
    };

    const result = await feesCollection.insertOne(newFee);

    return res.status(201).json({
      success: true,
      message: "ফি সফলভাবে পোস্ট করা হয়েছে",
      insertedId: result.insertedId
    });
  } catch (error) {
    console.error("Create Fee API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ২. GET: এডমিনের সেট করা সব ফি দেখা
app.get("/api/admin/fees", async (req, res) => {
  try {
    const fees = await feesCollection.find().sort({ createdAt: -1 }).toArray();
    return res.status(200).json({
      success: true,
      data: fees
    });
  } catch (error) {
    console.error("Get Fees API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ৩. PUT: সেট করা ফি এডিট/আপডেট করা
app.put("/api/admin/fees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, className, group, amount, dueDate } = req.body;
    const updatedFee = {
      title,
      category,
      className,
      group: (className === 'Class 9' || className === 'Class 10') ? (group || 'All') : 'General',
      amount: Number(amount),
      dueDate,
      updatedAt: new Date()
    };

    const result = await feesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedFee }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "ফি পাওয়া যায়নি" });
    }

    return res.status(200).json({
      success: true,
      message: "ফি সফলভাবে আপডেট করা হয়েছে"
    });
  } catch (error) {
    console.error("Update Fee API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ৪. DELETE: ফি ডিলিট করা
app.delete("/api/admin/fees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { ObjectId } = require("mongodb");

    const result = await feesCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "ফি পাওয়া যায়নি" });
    }

    return res.status(200).json({
      success: true,
      message: "ফি ডিলিট করা হয়েছে"
    });
  } catch (error) {
    console.error("Delete Fee API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ৫. GET:
app.get("/api/admin/payments", async (req, res) => {
  try {
    const payments = await paymentsCollection.find().sort({ createdAt: -1 }).toArray();

    const chartDataMap = {};
    payments.forEach((payment) => {
      if (payment.status === "Paid") {
        const cls = payment.className || "Unknown";
        chartDataMap[cls] = (chartDataMap[cls] || 0) + Number(payment.amount);
      }
    });

    const pieChartData = Object.keys(chartDataMap).map((className) => ({
      name: className,
      value: chartDataMap[className]
    }));

    return res.status(200).json({
      success: true,
      payments,      
      pieChartData   
    });
  } catch (error) {
    console.error("Get Payments API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});



// 1. GET SYSTEM SETTINGS & ANALYTICS

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


// 2. UPDATE SYSTEM SETTINGS (PUT)

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

// GET: notices (Student & Teacher Dashboard-
app.get('/api/notices', async (req, res) => {
  try {
    const { target } = req.query; // e.g. /api/notices?target=Students
    let query = {};

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


app.delete('/api/admin/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await noticeCollection.deleteOne({ _id: new ObjectId(id) });

    res.status(200).json({ success: true, message: "Notice deleted successfully", result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete notice" });
  }
});


// task 2.1 teacher panel


// 2. POST: Save/Upsert Student Attendance Record
// POST: Save or Update Attendance
app.post("/api/teacher/attendance", async (req, res) => {
  try {
    const { date, classId, group, subject, records, teacherEmail } = req.body;

    // ১. প্রয়োজনীয় Field ফিল্টারিং ও ভ্যালিডেশন
    if (!date || !classId || !subject || !records || !teacherEmail) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields (date, classId, subject, records, or teacherEmail)" 
      });
    }

    // ২. Database থেকে logged-in teacher-এর তথ্য খুঁজে বের করা
    const teacher = await usersCollection.findOne({ email: teacherEmail });

    if (!teacher) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher account not found in the database" 
      });
    }

    // ৩. Filter এবং Upsert Payload প্রস্তুত করা
    const filter = { date, classId, group, subject,teacherEmail };
    
    const updateDoc = {
      $set: {
        date,
        classId,
        group,
        subject,
        records,
        teacherEmail: teacher.email, // Logged-in teacher email
        teacherName: teacher.name,   // Logged-in teacher actual name (from db)
        updatedAt: new Date()
      }
    };

    // ৪. Attendance Collection-এ Save বা Update করা
    const result = await attendanceCollection.updateOne(filter, updateDoc, { upsert: true });

    res.json({ 
      success: true, 
      message: "Attendance recorded successfully",
      data: result 
    });

  } catch (error) {
    console.error("Attendance save error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error while saving attendance" 
    });
  }
});

app.get('/api/teacher/students', async (req, res) => {
  try {
    const { classId, group } = req.query;

    let query = { role: "student" };

    if (classId) {
      query.class = classId; // e.g. "Class 8", "Class 9"
    }

    if (group) {
      query.group = group; // e.g. "General", "Science", "Arts", "Commerce"
    }

    const students = await usersCollection
      .find(query)
      .toArray();

    res.status(200).json({ success: true, students });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// task 2.3 

// GET: Fetch Routine for Specific Teacher
// Route: /api/teacher/routine/:teacherEmail

app.get("/api/teacher/routine/:teacherEmail", async (req, res) => {
  try {
    const { teacherEmail } = req.params;
    const { day } = req.query;

    if (!teacherEmail) {
      return res.status(400).json({
        success: false,
        message: "Teacher email is required",
      });
    }

    // Email decode & trim
    const decodedEmail = decodeURIComponent(teacherEmail).trim();

    // Query for MongoDB - matching teacherId with email (Case-Insensitive)
    let query = {
      teacherId: { $regex: new RegExp(`^${decodedEmail}$`, "i") },
    };

    // Filter by day if provided and not "All"
    if (day && day !== "All") {
      query.day = day;
    }

    // Fetch matching routines from collection
    const myRoutines = await routineCollection
      .find(query)
      .sort({ startTime: 1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: myRoutines.length,
      routines: myRoutines,
    });
  } catch (error) {
    console.error("Error fetching teacher routine:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching teacher routine",
    });
  }
});

// task 2.4 marks 

// ==========================================
// 1. POST: Create or Update (Upsert) Marks
// ==========================================
app.post('/api/teacher/marks', async (req, res) => {
  try {
    const { classId, examType, subjectName, marks, teacherEmail } = req.body;
    if (!classId || !examType || !subjectName || !marks || !Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ success: false, message: "Required fields missing or invalid marks payload" });
    }

    if (!teacherEmail) {
      return res.status(400).json({ success: false, message: "Teacher email is required. Please log in again." });
    }
    const teacher = await usersCollection.findOne({ email: teacherEmail });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher account not found in database" });
    }

    // ৩. MongoDB Bulk Write Operation
    const operations = marks.map((item) => ({
      updateOne: {
        filter: {
          studentId: item.studentId,
          classId,
          examType,
          subjectName
        },
        update: {
          $set: {
            studentId: item.studentId,
            studentName: item.studentName || "N/A",
            roll: item.roll || "N/A",
            classId,
            examType,
            subjectName,
            teacherEmail: teacher.email, // টিচারের ইমেইল স্ট্রিং
            teacherName: teacher.name || "", // টিচারের নাম
            obtainedMarks: Number(item.obtainedMarks) || 0,
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    }));

    await marksCollection.bulkWrite(operations);
    res.status(200).json({ success: true, message: "Marks saved/updated successfully!" });
  } catch (error) {
    console.error("Error saving marks:", error);
    res.status(500).json({ success: false, message: "Failed to save marks" });
  }
});


// 2. GET: Read Marks (Filters: Class, Exam, Subject)

app.get('/api/teacher/marks', async (req, res) => {
  try {
    const { classId, examType, subjectName } = req.query;
    const query = {};

    if (classId) query.classId = classId;
    if (examType) query.examType = examType;
    if (subjectName) query.subjectName = subjectName;

    const existingMarks = await marksCollection.find(query).toArray();
    res.status(200).json({ success: true, marks: existingMarks });
  } catch (error) {
    console.error("Error fetching marks:", error);
    res.status(500).json({ success: false, message: "Failed to fetch marks" });
  }
});


// 3. DELETE: Clear Marks for Specific Exam & Subject

app.delete('/api/teacher/marks', async (req, res) => {
  try {
    const { classId, examType, subjectName } = req.query;

    if (!classId || !examType || !subjectName) {
      return res.status(400).json({ success: false, message: "Class, Exam Type, and Subject are required" });
    }

    const result = await marksCollection.deleteMany({ classId, examType, subjectName });
    res.status(200).json({ success: true, message: "Marks deleted successfully!", deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error deleting marks:", error);
    res.status(500).json({ success: false, message: "Failed to delete marks" });
  }
});



// TEACHER ASSIGNMENT MANAGEMENT APIs
// ১. POST: Teacher Assignment Publish API
app.post("/api/teacher/assignments", async (req, res) => {
  try {
    const { 
      title, 
      subject, 
      classId, 
      group, 
      description, 
      deadline, 
      teacherEmail, 
      teacherName 
    } = req.body;
    if (!title || !subject || !classId || !deadline || !teacherEmail) {
      return res.status(400).json({ 
        success: false, 
        message: "Required fields: title, subject, classId, deadline, teacherEmail" 
      });
    }

    const newAssignment = {
      title,
      subject,
      classId,
      group: group || "General",
      description: description || "",
      deadline: new Date(deadline), // ISO Date Format
      teacherEmail,
      teacherName: teacherName || "Teacher",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await assignmentsCollection.insertOne(newAssignment);

    return res.status(201).json({
      success: true,
      message: "Assignment published successfully!",
      assignmentId: result.insertedId
    });

  } catch (error) {
    console.error("Teacher Publish Assignment API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ২. GET: Teacher Posted Assignments List API
app.get("/api/teacher/assignments", async (req, res) => {
  try {
    const { teacherEmail } = req.query;

    if (!teacherEmail) {
      return res.status(400).json({ success: false, message: "Teacher email is required" });
    }
    const assignments = await assignmentsCollection
      .find({ teacherEmail })
      .sort({ createdAt: -1 })
      .toArray();
    const assignmentsWithStats = await Promise.all(
      assignments.map(async (item) => {
        const totalSubmissions = await submissionsCollection.countDocuments({
          assignmentId: item._id.toString()
        });

        return {
          id: item._id,
          title: item.title,
          subject: item.subject,
          classId: item.classId,
          group: item.group,
          description: item.description,
          deadline: item.deadline,
          createdAt: item.createdAt,
          totalSubmissions
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: assignmentsWithStats
    });

  } catch (error) {
    console.error("Teacher Fetch Assignments API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// PUT: Teacher Update Assignment API
app.put("/api/teacher/assignments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, classId, group, description, deadline } = req.body;
    const { ObjectId } = require("mongodb");

    if (!title || !subject || !classId || !deadline) {
      return res.status(400).json({ 
        success: false, 
        message: "Required fields: title, subject, classId, deadline" 
      });
    }

    const updatedData = {
      title,
      subject,
      classId,
      group: group || "General",
      description: description || "",
      deadline: new Date(deadline),
      updatedAt: new Date()
    };

    const result = await assignmentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Assignment updated successfully!"
    });

  } catch (error) {
    console.error("Teacher Update Assignment API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ৩. DELETE: Teacher Assignment Delete API
app.delete("/api/teacher/assignments/:id", async (req, res) => {
  try {
    const { id } = req.params;
  
    const result = await assignmentsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    await submissionsCollection.deleteMany({ assignmentId: id });

    return res.status(200).json({
      success: true,
      message: "Assignment and related submissions deleted successfully!"
    });

  } catch (error) {
    console.error("Teacher Delete Assignment API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});


app.get('/api/teacher/dashboard-stats', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Teacher email is required"
      });
    }
    // 1. Today's Classes
    const todayName = new Date().toLocaleDateString('en-US', {
      weekday: 'long'
    });

    let todaysClasses = 0;

    if (typeof routineCollection !== "undefined") {
      todaysClasses = await routineCollection.countDocuments({
        teacherId: email,
        day: todayName
      });
    }
    // 2. Total Students

    let totalStudents = 0;

    if (typeof usersCollection !== "undefined") {
      totalStudents = await usersCollection.countDocuments({
        role: "student"
      });
    }
    // ================================
    // 3. Today's Attendance Status
    let isAttendanceTaken = false;

    if (typeof attendanceCollection !== "undefined") {
      const todayStr = new Date().toISOString().split('T')[0];

      const todayAttendance =
        await attendanceCollection.findOne({
          teacherEmail: email,
          date: todayStr
        });

      isAttendanceTaken = !!todayAttendance;
    }
    // 4. Pending Marks
    let pendingMarks = 0;

    if (
      typeof marksCollection !== "undefined" &&
      typeof routineCollection !== "undefined"
    ) {

      // Get teacher's assigned routines
      const teacherRoutines = await routineCollection
        .find({
          teacherId: email
        })
        .project({
          classId: 1,
          className: 1,
          subjectName: 1
        })
        .toArray();


      // --------------------------------
      // Create unique Class + Subject
      // combinations
      const assignedSubjects = new Set();

      teacherRoutines.forEach((routine) => {

        const className =
          routine.classId ||
          routine.className;

        const subjectName =
          routine.subjectName;

        if (className && subjectName) {
          assignedSubjects.add(
            `${className}|||${subjectName}`
          );
        }
      });


      // Exams that teacher needs to submit
      const examTypes = [
        "First Term",
        "Midterm",
        "Final Exam"
      ];
      const submittedMarks = await marksCollection
        .find({
          teacherEmail: email
        })
        .project({
          classId: 1,
          subjectName: 1,
          examType: 1
        })
        .toArray();
      // Create Set of submitted
      // Class + Subject + Exam
      const submittedSet = new Set();
      submittedMarks.forEach((mark) => {

        if (
          mark.classId &&
          mark.subjectName &&
          mark.examType
        ) {

          submittedSet.add(
            `${mark.classId}|||${mark.subjectName}|||${mark.examType}`
          );

        }
      });
      // --------------------------------
      // Calculate Pending
      assignedSubjects.forEach((assignment) => {

        const [className, subjectName] =
          assignment.split("|||");

        examTypes.forEach((examType) => {

          const key =
            `${className}|||${subjectName}|||${examType}`;

          if (!submittedSet.has(key)) {
            pendingMarks++;
          }

        });

      });

    }
 // ================================
    // Final Response
    res.status(200).json({
      success: true,

      stats: {
        todaysClasses,
        totalStudents,
        pendingMarks,
        isAttendanceTaken
      }
    });

  } catch (error) {

    console.error(
      "Teacher Dashboard Stats Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message
    });

  }
});

//  my students list for teacher
 
app.get('/api/teacher/my-students', async (req, res) => {
  try {
    const { teacherEmail } = req.query;

    if (!teacherEmail) {
      return res.status(400).json({ success: false, message: "Teacher email is required" });
    }

    const teacherRoutines = await routineCollection.find({ teacherId: teacherEmail }).toArray();

    if (!teacherRoutines || teacherRoutines.length === 0) {
      return res.json({ 
        success: true, 
        students: [], 
        assignedClasses: [] 
      });
    }
    const classGroupFilters = [];
    const uniqueClassesSet = new Set();

    teacherRoutines.forEach(routine => {
      if (routine.classId) {
        uniqueClassesSet.add(routine.classId);
      
        const exists = classGroupFilters.some(
          item => item.class === routine.classId && item.group === routine.group
        );

        if (!exists) {
          const filterObj = { class: routine.classId };
          if (routine.group) {
            filterObj.group = routine.group;
          }
          classGroupFilters.push(filterObj);
        }
      }
    });
    let students = [];
    if (classGroupFilters.length > 0) {
      students = await usersCollection.find({
        role: "student",
        $or: classGroupFilters
      }).toArray();
    }

    res.json({
      success: true,
      assignedClasses: Array.from(uniqueClassesSet), // ["Class 8", ...]
      students: students
    });

  } catch (error) {
    console.error("Error fetching teacher's students:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET: Teacher Fetch Submissions for a Specific Assignment
app.get("/api/teacher/assignments/:id/submissions", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if assignment exists
    const submissions = await submissionsCollection
      .find({ assignmentId: id })
      .sort({ submittedAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: submissions
    });

  } catch (error) {
    console.error("Fetch Assignment Submissions API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});




app.get('/api/teacher/attendance-status', async (req, res) => {
  try {
    const { teacherEmail } = req.query;
    if (!teacherEmail) {
      return res.status(400).json({ success: false, message: "Teacher email required" });
    }
    const today = new Date().toISOString().split('T')[0];

    const attendanceRecord = await teacherAttendanceCollection.findOne({
      teacherId: teacherEmail,
      date: today
    });

    if (attendanceRecord) {
      return res.json({
        success: true,
        hasCheckedIn: true,
        attendance: attendanceRecord
      });
    }

    res.json({
      success: true,
      hasCheckedIn: false,
      attendance: null
    });
  } catch (error) {
    console.error("Error fetching attendance status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ২. API
app.post('/api/teacher/check-in', async (req, res) => {
  try {
    const { teacherEmail, teacherName } = req.body;

    if (!teacherEmail || !teacherName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // "2026-09-13"
    
    //  (As: "08:15 AM")
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const existingCheckIn = await teacherAttendanceCollection.findOne({
      teacherId: teacherEmail,
      date: today
    });

    if (existingCheckIn) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already checked in today!" 
      });
    }

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    let attendanceStatus = "Present";

    if (currentHour > 9 || (currentHour === 9 && currentMinute > 0)) {
      attendanceStatus = "Late";
    }

    const newAttendance = {
      teacherId: teacherEmail,
      teacherName: teacherName,
      date: today,
      inTime: formattedTime,
      status: attendanceStatus,
      createdAt: now
    };

    const result = await teacherAttendanceCollection.insertOne(newAttendance);

    res.status(201).json({
      success: true,
      message: `Checked in successfully as ${attendanceStatus}!`,
      attendance: { ...newAttendance, _id: result.insertedId }
    });

  } catch (error) {
    console.error("Error during check-in:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET: Student Dashboard Overview API
app.get("/api/student/dashboard", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Student email is required" 
      });
    }

    const student = await usersCollection.findOne({ email, role: "student" });
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: "Student profile not found" 
      });
    }

    const { _id, studentId, class: userClass, classId, group, name } = student;
    const currentClass = classId || userClass; // classId অথবা class যেটিই অবজেক্টে থাকুক

    const attendanceQuery = {
      $or: [{ classId: currentClass }, { class: currentClass }]
    };
    if (group) attendanceQuery.group = group;

    const attendanceRecords = await attendanceCollection.find(attendanceQuery).toArray();

    let totalClasses = 0;
    let presentCount = 0;

    attendanceRecords.forEach((record) => {
      const match = record.students?.find(
        (s) => s.studentId?.toString() === studentId?.toString() || s.studentId?.toString() === _id.toString()
      );
      if (match) {
        totalClasses += 1;
        if (match.status === "Present") presentCount += 1;
      }
    });

    const attendancePercentage = totalClasses > 0 
      ? Math.round((presentCount / totalClasses) * 100) 
      : 0;
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    
    const routineQuery = { 
      day: todayName,
      $or: [{ classId: currentClass }, { class: currentClass }]
    };
    if (group) routineQuery.group = group;

    const todayClasses = await routineCollection
      .find(routineQuery)
      .sort({ startTime: 1 })
      .toArray();
    const notices = await noticeCollection
      .find({
        $or: [
          { targetAudience: "All" }, 
          { targetAudience: "Students" }, 
          { classId: currentClass },
          { class: currentClass }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    // 5. রেসপন্স পাঠানো
    return res.status(200).json({
      success: true,
      data: {
        profile: { 
          name, 
          studentId: studentId || "N/A", 
          class: currentClass, 
          group: group || "General" 
        },
        stats: { 
          attendancePercentage, 
          presentCount, 
          totalClasses 
        },
        todayClasses: todayClasses.map((c) => ({
          id: c._id,
          subjectName: c.subjectName,
          teacherName: c.teacherName || "Instructor",
          startTime: c.startTime,
          endTime: c.endTime,
          roomNo: c.roomNo || "N/A"
        })),
        notices: notices.map((n) => ({
          id: n._id,
          title: n.title,
          description: n.description,
          category: n.category || "General",
          date: new Date(n.createdAt).toLocaleDateString("en-US", { 
            month: "short", 
            day: "numeric" 
          })
        }))
      }
    });

  } catch (error) {
    console.error("Student Dashboard API Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});
// GET: Student Full Routine API
app.get("/api/student/routine", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // ১. user collection 
    const student = await usersCollection.findOne({ email, role: "student" });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const currentClass = student.classId || student.class;
    const group = student.group;

    // ২. routine collection 
    const routineQuery = {
      $or: [{ classId: currentClass }, { class: currentClass }]
    };
    if (group) routineQuery.group = group;

    const allRoutines = await routineCollection
      .find(routineQuery)
      .sort({ startTime: 1 })
      .toArray();
    const daysOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const weeklyRoutine = daysOrder.map((day) => {
      const classesForDay = allRoutines
        .filter((r) => r.day === day)
        .map((c) => ({
          id: c._id,
          subjectName: c.subjectName,
          teacherName: c.teacherName || "Instructor",
          startTime: c.startTime,
          endTime: c.endTime,
          roomNo: c.roomNo || "N/A"
        }));

      return {
        day,
        classes: classesForDay
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        className: currentClass,
        group: group || "General",
        weeklyRoutine
      }
    });

  } catch (error) {
    console.error("Student Routine API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET: Student Full Attendance API
// GET: Student Attendance API
app.get("/api/student/attendance", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // ১. user collection 
    const student = await usersCollection.findOne({ email, role: "student" });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const { _id, studentId, class: userClass, classId, group } = student;
    const currentClass = classId || userClass;

    // ২. attendance collection 
    const attendanceQuery = {
      $or: [{ classId: currentClass }, { class: currentClass }]
    };
    if (group) attendanceQuery.group = group;

    const allRecords = await attendanceCollection.find(attendanceQuery).toArray();

    let totalClassesAll = 0;
    let presentClassesAll = 0;
    const subjectWiseMap = {};
    const recentLogs = [];

    allRecords.forEach((record) => {
      const studentList = record.records || record.students || [];
      const match = studentList.find(
        (s) => s.studentId?.toString() === studentId?.toString() || s.studentId?.toString() === _id.toString()
      );

      if (match) {
        totalClassesAll += 1;
        const isPresent = match.status === "Present";
        if (isPresent) presentClassesAll += 1;
        const subName = record.subject || record.subjectName || "General";
        if (!subjectWiseMap[subName]) {
          subjectWiseMap[subName] = { subjectName: subName, total: 0, present: 0 };
        }
        subjectWiseMap[subName].total += 1;
        if (isPresent) subjectWiseMap[subName].present += 1;
        recentLogs.push({
          id: record._id,
          date: record.date || new Date(record.updatedAt || record.createdAt).toISOString().split("T")[0],
          subjectName: subName,
          status: match.status,
          teacherName: record.teacherName || match.teacherName || "Instructor"
        });
      }
    });

    const overallPercentage = totalClassesAll > 0 
      ? Math.round((presentClassesAll / totalClassesAll) * 100) 
      : 0;

    const subjectWiseStats = Object.values(subjectWiseMap).map((sub) => ({
      subjectName: sub.subjectName,
      total: sub.total,
      present: sub.present,
      percentage: sub.total > 0 ? Math.round((sub.present / sub.total) * 100) : 0
    }));
    recentLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      success: true,
      data: {
        overall: {
          totalClasses: totalClassesAll,
          presentCount: presentClassesAll,
          absentCount: totalClassesAll - presentClassesAll,
          percentage: overallPercentage
        },
        subjectWiseStats,
        recentLogs
      }
    });

  } catch (error) {
    console.error("Student Attendance API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET: Student Exam Results API
app.get("/api/student/results", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // ১. user collection 
    const student = await usersCollection.findOne({ email, role: "student" });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const { _id, studentId, class: userClass, classId } = student;
    const currentClass = classId || userClass;

    // ২. marks collection 
    const markRecords = await marksCollection
      .find({
        $or: [
          { studentId: studentId?.toString() },
          { studentId: _id?.toString() }
        ]
      })
      .toArray();

    // ৩. examType 
    const examMap = {};

    markRecords.forEach((record) => {
      const examName = record.examType || record.examName || record.term || "Final Exam";
      const subjectName = record.subjectName || record.subject || "Subject";
      const obtainedMarks = Number(record.obtainedMarks || record.marks || 0);
      const totalMarks = Number(record.totalMarks || 100);

      // 
      const calculateGrade = (score, max) => {
        const percentage = (score / max) * 100;
        if (percentage >= 80) return { grade: "A+", point: 5.0 };
        if (percentage >= 70) return { grade: "A", point: 4.0 };
        if (percentage >= 60) return { grade: "A-", point: 3.5 };
        if (percentage >= 50) return { grade: "B", point: 3.0 };
        if (percentage >= 40) return { grade: "C", point: 2.0 };
        if (percentage >= 33) return { grade: "D", point: 1.0 };
        return { grade: "F", point: 0.0 };
      };

      const { grade, point } = calculateGrade(obtainedMarks, totalMarks);

      if (!examMap[examName]) {
        examMap[examName] = {
          examName,
          subjects: []
        };
      }

      examMap[examName].subjects.push({
        id: record._id,
        subjectName,
        obtainedMarks,
        totalMarks,
        grade,
        point
      });
    });

    // ৪.
    const examResults = Object.values(examMap).map((exam) => {
      const totalPoints = exam.subjects.reduce((sum, s) => sum + s.point, 0);
      const hasFailed = exam.subjects.some((s) => s.grade === "F");
      const gpa = hasFailed || exam.subjects.length === 0 
        ? "0.00 (F)" 
        : (totalPoints / exam.subjects.length).toFixed(2);

      return {
        examName: exam.examName,
        gpa,
        subjects: exam.subjects
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        className: currentClass,
        examResults
      }
    });

  } catch (error) {
    console.error("Student Results API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// STUDENT ASSIGNMENT APIs
// ১. GET: Student Assignments List with Status
app.get("/api/student/assignments", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    const student = await usersCollection.findOne({ email, role: "student" });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const currentClass = student.classId || student.class;
    const studentGroup = student.group || "General";

    const assignmentQuery = {
      $or: [{ classId: currentClass }, { class: currentClass }]
    };

    if (currentClass === "Class 9" || currentClass === "Class 10") {
      assignmentQuery.group = studentGroup;
    }

    const assignments = await assignmentsCollection
      .find(assignmentQuery)
      .sort({ createdAt: -1 })
      .toArray();

    const studentIdStr = student.studentId?.toString() || student._id.toString();

    
    const assignmentsWithStatus = await Promise.all(
      assignments.map(async (item) => {
        const submission = await submissionsCollection.findOne({
          assignmentId: item._id.toString(),
          $or: [{ studentId: studentIdStr }, { studentEmail: email }]
        });

        const now = new Date();
        const deadline = new Date(item.deadline);

        let status = "Pending";
        if (submission) {
          status = submission.status || "Submitted";
        } else if (now > deadline) {
          status = "Late";
        }

        return {
          id: item._id,
          title: item.title,
          subject: item.subject,
          teacherName: item.teacherName || "Instructor",
          description: item.description,
          deadline: item.deadline,
          status, // Pending | Submitted | Late | Completed
          submission: submission
            ? {
                submissionText: submission.submissionText,
                fileUrl: submission.fileUrl,
                submittedAt: submission.submittedAt,
                marks: submission.marks
              }
            : null
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: assignmentsWithStatus
    });

  } catch (error) {
    console.error("Student Assignments API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ২. POST: Submit Assignment Solution
app.post("/api/student/assignments/submit", async (req, res) => {
  try {
    const { assignmentId, studentEmail, submissionText, fileUrl } = req.body;

    if (!assignmentId || !studentEmail || (!submissionText && !fileUrl)) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID, student email, and answer text/file link are required"
      });
    }

    const student = await usersCollection.findOne({ email: studentEmail, role: "student" });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const assignment = await assignmentsCollection.findOne({ _id: new (require("mongodb").ObjectId)(assignmentId) });
    if (!assignment) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    const now = new Date();
    const deadline = new Date(assignment.deadline);
    const isLate = now > deadline;

    const studentIdStr = student.studentId?.toString() || student._id.toString();

    const submissionData = {
      assignmentId,
      studentId: studentIdStr,
      studentEmail,
      studentName: student.name || "Student",
      submissionText: submissionText || "",
      fileUrl: fileUrl || "",
      submittedAt: now,
      status: isLate ? "Late" : "Submitted",
      marks: null
    };
    await submissionsCollection.updateOne(
      { assignmentId, $or: [{ studentId: studentIdStr }, { studentEmail }] },
      { $set: submissionData },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: isLate
        ? "Assignment submitted (Marked as Late)"
        : "Assignment submitted successfully!"
    });

  } catch (error) {
    console.error("Student Submit Assignment API Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});



// STUDENT FEES & PAYMENT APIs

// Endpoint: /api/student/fees?className=Class 9&group=Science
app.get("/api/student/fees", async (req, res) => {
  try {
    const { className, group } = req.query;

    if (!className) {
      return res.status(400).json({ success: false, message: "Class is required" });
    }
    let query = { className };

    if (className === "Class 9" || className === "Class 10") {
      if (group) {
        query.group = { $in: [group, "All"] };
      }
    }

    const fees = await feesCollection.find(query).sort({ createdAt: -1 }).toArray();

    return res.status(200).json({
      success: true,
      data: fees
    });
  } catch (error) {
    console.error("Student Get Fees Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// Endpoint: /api/student/pay
app.post("/api/student/pay", async (req, res) => {
  try {
    const { studentName, className, group, roll, feeTitle, amount, trxID } = req.body;

    if (!studentName || !className || !roll || !feeTitle || !amount || !trxID) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    
    const existingPayment = await paymentsCollection.findOne({ trxID });
    if (existingPayment) {
      return res.status(400).json({ success: false, message: "This bKash TrxID has already been used!" });
    }

    const newPayment = {
      studentName,
      className,
      group: group || 'General',
      roll,
      feeTitle,
      amount: Number(amount),
      paymentMethod: 'bKash',
      trxID,
      status: 'Paid',
      createdAt: new Date()
    };

    const result = await paymentsCollection.insertOne(newPayment);

    return res.status(201).json({
      success: true,
      message: "Payment submitted successfully!",
      insertedId: result.insertedId
    });
  } catch (error) {
    console.error("Student Pay Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get('/api/notice', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit);
    const notices = await noticeCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    res.status(200).json(notices);
  } catch (error) {
    console.error("Notice fetch error:", error);
    res.status(500).json({ 
      success: false, 
      message: "নোটিশ লোড করতে সমস্যা হয়েছে", 
      error: error.message 
    });
  }
});


// 🚀 1. FORGOT PASSWORD API
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If the email exists, an OTP has been sent.",
      });
    }

    // Better Auth reset token generate করবে
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${process.env.BETTER_AUTH_URL}/reset-password`,
      },
    });

    res.status(200).json({
      success: true,
      message: "An OTP has been sent to your email.",
    });

  } catch (error) {
    console.error("Forgot Password Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send OTP email.",
    });
  }
});


// 🚀 2. RESET PASSWORD API
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // OTP + expiry check
    const user = await usersCollection.findOne({
      email,
      resetOtp: otp,
      resetOtpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP!",
      });
    }

    // Better Auth reset token
    if (!user.resetPasswordToken) {
      return res.status(400).json({
        success: false,
        message: "Password reset token not found or expired.",
      });
    }

    // 🔥 Better Auth দিয়ে আসল password reset
    await auth.api.resetPassword({
      body: {
        newPassword,
        token: user.resetPasswordToken,
      },
    });

    // OTP + token remove
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $unset: {
          resetOtp: "",
          resetOtpExpires: "",
          resetPasswordToken: "",
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Password reset successful!",
    });

  } catch (error) {
    console.error("Reset Password Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reset password.",
    });
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