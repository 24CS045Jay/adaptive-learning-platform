import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createTeamsOnlineMeeting,
  deleteTeamsOnlineMeeting,
  getGraphAccessToken,
  isTeamsConfigured,
  resetTokenCache,
  getTeamsConfigurationStatus,
} from "../lib/teams-meeting.js";

describe("Microsoft Teams Online Meeting Integration Suite", () => {
  const originalEnv = { ...process.env };
  let originalFetch;

  beforeEach(() => {
    resetTokenCache();
    originalFetch = globalThis.fetch;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    resetTokenCache();
  });

  describe("1. Configuration & Validation", () => {
    it("reports not configured when required environment variables are missing", () => {
      delete process.env.MICROSOFT_TENANT_ID;
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;
      delete process.env.MICROSOFT_ORGANIZER_USER_ID;

      assert.equal(isTeamsConfigured(), false);
      const status = getTeamsConfigurationStatus();
      assert.equal(status.isConfigured, false);
      assert.equal(status.hasTenantId, false);
    });

    it("fails with TEAMS_CONFIG_MISSING when attempting to get token without credentials", async () => {
      delete process.env.MICROSOFT_TENANT_ID;
      delete process.env.MICROSOFT_CLIENT_ID;

      await assert.rejects(
        async () => {
          await getGraphAccessToken();
        },
        (err) => {
          assert.equal(err.code, "TEAMS_CONFIG_MISSING");
          assert.equal(err.status, 503);
          return true;
        },
      );
    });

    it("rejects meetings scheduled in the past with START_TIME_PAST", async () => {
      process.env.MICROSOFT_TENANT_ID = "mock-tenant";
      process.env.MICROSOFT_CLIENT_ID = "mock-client";
      process.env.MICROSOFT_CLIENT_SECRET = "mock-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "mock-organizer";

      const pastStart = new Date(Date.now() - 3600000).toISOString();
      const pastEnd = new Date(Date.now() - 1800000).toISOString();

      await assert.rejects(
        async () => {
          await createTeamsOnlineMeeting({
            subject: "Past Meeting",
            startTime: pastStart,
            endTime: pastEnd,
          });
        },
        (err) => {
          assert.equal(err.code, "START_TIME_PAST");
          assert.equal(err.status, 400);
          return true;
        },
      );
    });

    it("rejects meetings where end time is before or equal to start time", async () => {
      process.env.MICROSOFT_TENANT_ID = "mock-tenant";
      process.env.MICROSOFT_CLIENT_ID = "mock-client";
      process.env.MICROSOFT_CLIENT_SECRET = "mock-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "mock-organizer";

      const futureStart = new Date(Date.now() + 3600000).toISOString();
      const earlierEnd = new Date(Date.now() + 1800000).toISOString();

      await assert.rejects(
        async () => {
          await createTeamsOnlineMeeting({
            subject: "Invalid Time Range",
            startTime: futureStart,
            endTime: earlierEnd,
          });
        },
        (err) => {
          assert.equal(err.code, "END_TIME_BEFORE_START");
          assert.equal(err.status, 400);
          return true;
        },
      );
    });
  });

  describe("2. Authentication & Token Management", () => {
    it("successfully acquires and reuses Graph access token until expiry", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";

      let fetchCallCount = 0;
      globalThis.fetch = async (url) => {
        if (url.includes("/token")) {
          fetchCallCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: "mock-valid-jwt-token-12345",
              expires_in: 3600,
            }),
          };
        }
        throw new Error("Unexpected URL: " + url);
      };

      const token1 = await getGraphAccessToken();
      assert.equal(token1, "mock-valid-jwt-token-12345");
      assert.equal(fetchCallCount, 1);

      // Second call should reuse cached token
      const token2 = await getGraphAccessToken();
      assert.equal(token2, "mock-valid-jwt-token-12345");
      assert.equal(fetchCallCount, 1); // Not called again!
    });

    it("handles token acquisition failure cleanly without leaking credentials", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";

      globalThis.fetch = async (url) => {
        if (url.includes("/token")) {
          return {
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: async () => ({
              error: "invalid_client",
              error_description: "AADSTS7000215: Invalid client secret is provided.",
            }),
          };
        }
        throw new Error("Unexpected URL");
      };

      await assert.rejects(
        async () => {
          await getGraphAccessToken();
        },
        (err) => {
          assert.equal(err.code, "TEAMS_AUTH_FAILED");
          assert.equal(err.status, 401);
          assert.match(err.message, /AADSTS7000215/);
          return true;
        },
      );
    });
  });

  describe("3. Microsoft Graph Online Meetings Creation", () => {
    const validFutureStart = new Date(Date.now() + 3600000).toISOString();
    const validFutureEnd = new Date(Date.now() + 7200000).toISOString();

    it("creates an authentic Teams meeting and extracts real joinWebUrl", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "00000000-0000-0000-0000-000000000001";

      const realGraphJoinUrl = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_real_graph_test%40thread.v2/0?context=%7b%22Tid%22%3a%22test-tenant%22%7d";
      const realGraphMeetingId = "MSo0NzY0M2M1MC0zNTY2LTQ5N2QtYmIwNy00ZTVlYTM5ZGI2YjkqMCoqMTk6bWVldGluZw==";

      globalThis.fetch = async (url, options) => {
        if (url.includes("/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-token", expires_in: 3600 }),
          };
        }
        if (url.includes("/onlineMeetings")) {
          assert.equal(options.method, "POST");
          assert.equal(options.headers.Authorization, "Bearer mock-token");
          const payload = JSON.parse(options.body);
          assert.equal(payload.subject, "Big Data Analytics Doubt Solving");

          return {
            ok: true,
            status: 201,
            json: async () => ({
              id: realGraphMeetingId,
              joinWebUrl: realGraphJoinUrl,
              subject: payload.subject,
              startDateTime: payload.startDateTime,
              endDateTime: payload.endDateTime,
            }),
          };
        }
        throw new Error("Unexpected URL: " + url);
      };

      const result = await createTeamsOnlineMeeting({
        subject: "Big Data Analytics Doubt Solving",
        startTime: validFutureStart,
        endTime: validFutureEnd,
        facultyEmail: "prof.rajesh@charusat.edu.in",
        attendeeEmails: ["24cs045@charusat.edu.in"],
      });

      assert.equal(result.success, true);
      assert.equal(result.provider, "microsoft_teams");
      assert.equal(result.isLive, true);
      assert.equal(result.meetingId, realGraphMeetingId);
      assert.equal(result.joinWebUrl, realGraphJoinUrl);
      // Explicitly assert NO mock strings or fabricated tokens exist
      assert.equal(result.joinWebUrl.includes("teams-mock"), false);
      assert.equal(result.joinWebUrl.includes("edusense-university-tenant"), false);
    });

    it("handles Graph 403 Forbidden with actionable policy error message", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "00000000-0000-0000-0000-000000000001";

      globalThis.fetch = async (url) => {
        if (url.includes("/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-token", expires_in: 3600 }),
          };
        }
        if (url.includes("/onlineMeetings")) {
          return {
            ok: false,
            status: 403,
            statusText: "Forbidden",
            json: async () => ({
              error: {
                code: "GeneralException",
                message: "Access is denied.",
              },
            }),
          };
        }
        throw new Error("Unexpected URL");
      };

      await assert.rejects(
        async () => {
          await createTeamsOnlineMeeting({
            subject: "Test Session",
            startTime: validFutureStart,
            endTime: validFutureEnd,
          });
        },
        (err) => {
          assert.equal(err.status, 403);
          assert.match(err.message, /Application Access Policy/);
          return true;
        },
      );
    });

    it("handles Graph 404 with invalid organizer error message", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "invalid-user-oid";

      globalThis.fetch = async (url) => {
        if (url.includes("/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-token", expires_in: 3600 }),
          };
        }
        if (url.includes("/onlineMeetings")) {
          return {
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: async () => ({
              error: {
                code: "ResourceNotFound",
                message: "User was not found.",
              },
            }),
          };
        }
        throw new Error("Unexpected URL");
      };

      await assert.rejects(
        async () => {
          await createTeamsOnlineMeeting({
            subject: "Test Session",
            startTime: validFutureStart,
            endTime: validFutureEnd,
          });
        },
        (err) => {
          assert.equal(err.status, 404);
          assert.match(err.message, /not found in Microsoft Entra directory/);
          return true;
        },
      );
    });

    it("handles Graph 429 Throttling with retry advisory", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "test-organizer-oid";

      globalThis.fetch = async (url) => {
        if (url.includes("/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-token", expires_in: 3600 }),
          };
        }
        if (url.includes("/onlineMeetings")) {
          return {
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            json: async () => ({
              error: { code: "ActivityLimitReached", message: "Throttled" },
            }),
          };
        }
        throw new Error("Unexpected URL");
      };

      await assert.rejects(
        async () => {
          await createTeamsOnlineMeeting({
            subject: "Test Session",
            startTime: validFutureStart,
            endTime: validFutureEnd,
          });
        },
        (err) => {
          assert.equal(err.status, 429);
          assert.match(err.message, /rate limit reached/i);
          return true;
        },
      );
    });

    it("fails with TEAMS_JOIN_URL_MISSING if response does not contain joinWebUrl", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "test-organizer-oid";

      globalThis.fetch = async (url) => {
        if (url.includes("/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-token", expires_in: 3600 }),
          };
        }
        if (url.includes("/onlineMeetings")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "meeting-id-without-url",
              // joinWebUrl is intentionally missing
            }),
          };
        }
        throw new Error("Unexpected URL");
      };

      await assert.rejects(
        async () => {
          await createTeamsOnlineMeeting({
            subject: "Test Session",
            startTime: validFutureStart,
            endTime: validFutureEnd,
          });
        },
        (err) => {
          assert.equal(err.code, "TEAMS_JOIN_URL_MISSING");
          assert.equal(err.status, 502);
          return true;
        },
      );
    });

    it("never returns fake meeting URLs when Graph call fails", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "test-organizer-oid";

      globalThis.fetch = async (url) => {
        if (url.includes("/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-token", expires_in: 3600 }),
          };
        }
        if (url.includes("/onlineMeetings")) {
          return {
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            text: async () => "Temporary downstream error",
          };
        }
        throw new Error("Unexpected URL");
      };

      // Must throw honest error and NEVER fabricate a fallback URL
      await assert.rejects(async () => {
        await createTeamsOnlineMeeting({
          subject: "Test Session",
          startTime: validFutureStart,
          endTime: validFutureEnd,
        });
      });
    });

    it("successfully sends DELETE to Graph when deleteTeamsOnlineMeeting is called", async () => {
      process.env.MICROSOFT_TENANT_ID = "test-tenant-id";
      process.env.MICROSOFT_CLIENT_ID = "test-client-id";
      process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
      process.env.MICROSOFT_ORGANIZER_USER_ID = "test-organizer-oid";

      let deleteCalled = false;
      globalThis.fetch = async (url, options) => {
        if (url.includes("/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "mock-token", expires_in: 3600 }),
          };
        }
        if (url.includes("/onlineMeetings/meeting-to-delete-123")) {
          assert.equal(options.method, "DELETE");
          deleteCalled = true;
          return { ok: true, status: 204 };
        }
        throw new Error("Unexpected URL");
      };

      const deleted = await deleteTeamsOnlineMeeting({
        meetingId: "meeting-to-delete-123",
      });
      assert.equal(deleted, true);
      assert.equal(deleteCalled, true);
    });
  });
});
