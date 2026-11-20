const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, index: true },
    studentName: { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    category: {
      type: String,
      required: true,
      enum: ["Academic", "Infrastructure", "Electrical", "Cleanliness", "Hostel", "Transport", "Safety", "Other"]
    },
    categorySuggestion: {
      type: String,
      enum: ["Academic", "Infrastructure", "Electrical", "Cleanliness", "Hostel", "Transport", "Safety", "Other"]
    },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    summary: { type: String, required: true },
    priority: { type: String, required: true, enum: ["Low", "Medium", "High"] },
    status: { type: String, required: true, enum: ["Pending", "In Progress", "Resolved"], default: "Pending" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
