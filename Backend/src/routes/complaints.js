const express = require("express");
const { randomUUID } = require("node:crypto");
const Complaint = require("../models/Complaint");
const { analyzeComplaint } = require("../ai");
const { attachStaff, requireStaff } = require("../auth");

const router = express.Router();
const CATEGORIES = ["Academic", "Infrastructure", "Electrical", "Cleanliness", "Hostel", "Transport", "Safety", "Other"];
const STATUSES = ["Pending", "In Progress", "Resolved"];

function validateText(value, label, minLength, maxLength) {
  if (typeof value !== "string" || value.trim().length < minLength || value.trim().length > maxLength) {
    return `${label} must be between ${minLength} and ${maxLength} characters.`;
  }
  return null;
}

function validateComplaintInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return ["Request body must be an object."];
  const errors = [];
  const fields = ["studentName", "department", "description"];
  for (const field of fields) {
    if (!partial || Object.prototype.hasOwnProperty.call(body, field)) {
      const bounds = field === "description" ? [10, 3000] : [2, 100];
      const error = validateText(body[field], field, ...bounds);
      if (error) errors.push(error);
    }
  }
  if ((!partial || Object.prototype.hasOwnProperty.call(body, "category")) &&
      body.category !== undefined && body.category !== "Auto-detect" && !CATEGORIES.includes(body.category)) {
    errors.push("Category is not supported.");
  }
  return errors;
}

router.get("/", requireStaff, async (req, res, next) => {
  try {
    const { category, status, q } = req.query;
    const filter = {};
    if (category) {
      if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Category filter is not supported." });
      filter.category = category;
    }
    if (status) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: "Status filter is not supported." });
      filter.status = status;
    }
    if (q) filter.complaintId = { $regex: String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).lean();
    res.json(complaints);
  } catch (error) {
    next(error);
  }
});

router.get("/stats", requireStaff, async (req, res, next) => {
  try {
    const [total, counts] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    ]);
    const byStatus = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]));
    res.json({
      total,
      pending: byStatus.Pending || 0,
      inProgress: byStatus["In Progress"] || 0,
      resolved: byStatus.Resolved || 0
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:complaintId", attachStaff, async (req, res, next) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.complaintId }).lean();
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    if (req.staff) return res.json(complaint);
    res.json({
      complaintId: complaint.complaintId,
      category: complaint.category,
      status: complaint.status,
      createdAt: complaint.createdAt
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const errors = validateComplaintInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const ai = analyzeComplaint(req.body.description.trim());
    const categorySuggestion = ai.category;
    const category = req.body.category && req.body.category !== "Auto-detect"
      ? req.body.category
      : categorySuggestion;
    const complaint = await Complaint.create({
      complaintId: `SC-${new Date().getFullYear()}-${randomUUID().slice(0, 16).toUpperCase()}`,
      studentName: req.body.studentName.trim(),
      department: req.body.department.trim(),
      category,
      categorySuggestion,
      description: req.body.description.trim(),
      summary: ai.summary,
      priority: ai.priority,
      status: "Pending"
    });
    res.status(201).json(complaint);
  } catch (error) {
    next(error);
  }
});

router.put("/:complaintId", requireStaff, async (req, res, next) => {
  try {
    const errors = validateComplaintInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const ai = analyzeComplaint(req.body.description.trim());
    const categorySuggestion = ai.category;
    const category = req.body.category && req.body.category !== "Auto-detect"
      ? req.body.category
      : categorySuggestion;
    const complaint = await Complaint.findOneAndUpdate(
      { complaintId: req.params.complaintId },
      {
        studentName: req.body.studentName.trim(),
        department: req.body.department.trim(),
        category,
        categorySuggestion,
        description: req.body.description.trim(),
        summary: ai.summary,
        priority: ai.priority
      },
      { new: true, runValidators: true }
    );
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    res.json(complaint);
  } catch (error) {
    next(error);
  }
});

router.patch("/:complaintId/status", requireStaff, async (req, res, next) => {
  try {
    if (!req.body || !STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: "Status must be Pending, In Progress or Resolved." });
    }
    const complaint = await Complaint.findOneAndUpdate(
      { complaintId: req.params.complaintId },
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    res.json(complaint);
  } catch (error) {
    next(error);
  }
});

router.delete("/:complaintId", requireStaff, async (req, res, next) => {
  try {
    const complaint = await Complaint.findOneAndDelete({ complaintId: req.params.complaintId });
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    res.json({ message: "Complaint deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
