
const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");

const client = new MongoClient(process.env.MONGODB_SERVER_URL);
const db = client.db("edumanage");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,

  secret: process.env.BETTER_AUTH_SECRET,

  database: mongodbAdapter(db, {
    client,
  }),

  emailAndPassword: {
    enabled: true,

    sendResetPassword: async ({ user, token }) => {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      // OTP + Better Auth token save
      await db.collection("user").updateOne(
        { email: user.email },
        {
          $set: {
            resetOtp: otp,
            resetOtpExpires: otpExpires,
            resetPasswordToken: token,
            updatedAt: new Date(),
          },
        }
      );

      const mailOptions = {
        from: `"EduManage Support" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "EduManage - Password Reset OTP",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2>Password Reset Verification Code</h2>

            <p>Use the following 6-digit OTP to reset your password:</p>

            <h1 style="
              background: #4F46E5;
              color: white;
              padding: 10px 20px;
              display: inline-block;
              letter-spacing: 5px;
              border-radius: 8px;
            ">
              ${otp}
            </h1>

            <p>This code is valid for <b>10 minutes</b>.</p>

            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    },
  },
});

module.exports = { auth };