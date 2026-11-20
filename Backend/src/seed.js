require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const Complaint = require("./models/Complaint");
const { analyzeComplaint } = require("./ai");

const samples = [
  { studentName: "Aarav Mehta", department: "Computer Science", category: "Electrical", description: "The ceiling fans in Lab 2 are not working and the room becomes very warm during afternoon classes." },
  { studentName: "Priya Sharma", department: "Mechanical Engineering", category: "Cleanliness", description: "The washroom near the engineering workshop has not been cleaned for several days." },
  { studentName: "Ishaan Kapoor", department: "Business Administration", category: "Infrastructure", description: "There is a water leak from the ceiling in classroom B14 whenever it rains." }
];

async function seed() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured in Backend/.env.");
  await mongoose.connect(process.env.MONGO_URI);
  if (await Complaint.countDocuments() === 0) {
    await Complaint.insertMany(samples.map((sample) => ({
      ...sample,
      complaintId: `SC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      categorySuggestion: analyzeComplaint(sample.description).category,
      summary: analyzeComplaint(sample.description).summary,
      priority: analyzeComplaint(sample.description).priority,
      status: "Pending"
    })));
    console.log("Added three sample complaints to MongoDB.");
  } else {
    console.log("MongoDB already contains complaints; sample data was not added.");
  }
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(`Unable to seed complaints: ${error.message}`);
  await mongoose.disconnect();
  process.exitCode = 1;
});
