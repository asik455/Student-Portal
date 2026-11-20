const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createServer } = require("node:http");
const Complaint = require("./models/Complaint");
const { createAuthRouter } = require("./auth");
const complaintsRouter = require("./routes/complaints");

const originalAdminEmail = process.env.ADMIN_EMAIL;
const originalAdminPassword = process.env.ADMIN_PASSWORD;
const testEmail = "staff-test@campus.edu";
const testPassword = "a-long-test-password";
const app = express();
const server = createServer(app);

test.before(async () => {
  process.env.ADMIN_EMAIL = testEmail;
  process.env.ADMIN_PASSWORD = testPassword;
  app.use(express.json());
  app.use("/api/auth", createAuthRouter());
  app.use("/api/complaints", complaintsRouter);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = originalAdminEmail;
  if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = originalAdminPassword;
});

function url(path) {
  return `http://127.0.0.1:${server.address().port}${path}`;
}

test("staff login issues an HttpOnly session cookie and logout revokes it", async () => {
  const invalid = await fetch(url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "wrong-password" })
  });
  assert.equal(invalid.status, 401);

  const login = await fetch(url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail.toUpperCase(), password: testPassword })
  });
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { authenticated: true, email: testEmail });

  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(";")[0];

  const session = await fetch(url("/api/auth/session"), { headers: { Cookie: cookie } });
  assert.deepEqual(await session.json(), { authenticated: true, email: testEmail });

  const complaint = {
    complaintId: "SC-2026-TEST0001",
    category: "Electrical",
    status: "Pending",
    createdAt: "2026-11-20T00:00:00.000Z",
    studentName: "Private Student",
    department: "Engineering",
    description: "A private complaint description."
  };
  const originalFindOne = Complaint.findOne;
  Complaint.findOne = () => ({ lean: async () => complaint });
  try {
    const publicDetails = await fetch(url(`/api/complaints/${complaint.complaintId}`));
    assert.deepEqual(await publicDetails.json(), {
      complaintId: complaint.complaintId,
      category: complaint.category,
      status: complaint.status,
      createdAt: complaint.createdAt
    });

    const staffDetails = await fetch(url(`/api/complaints/${complaint.complaintId}`), {
      headers: { Cookie: cookie }
    });
    assert.deepEqual(await staffDetails.json(), complaint);
  } finally {
    Complaint.findOne = originalFindOne;
  }

  const logout = await fetch(url("/api/auth/logout"), {
    method: "POST",
    headers: { Cookie: cookie }
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);

  const expiredSession = await fetch(url("/api/auth/session"), { headers: { Cookie: cookie } });
  assert.deepEqual(await expiredSession.json(), { authenticated: false });
});

test("complaint list, statistics, and staff mutations require a session", async () => {
  const requests = [
    fetch(url("/api/complaints")),
    fetch(url("/api/complaints/stats")),
    fetch(url("/api/complaints/SC-2026-TEST0001"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: "Student Example",
        department: "Computer Science",
        category: "Other",
        description: "A detailed complaint that would otherwise be valid."
      })
    }),
    fetch(url("/api/complaints/SC-2026-TEST0001/status"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Resolved" })
    }),
    fetch(url("/api/complaints/SC-2026-TEST0001"), { method: "DELETE" })
  ];
  const responses = await Promise.all(requests);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401]);
});
