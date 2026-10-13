/**
 * Microsoft Teams Online Meeting Integration Service
 * EduSense AI — Adaptive Learning Platform
 *
 * Implements real Microsoft Graph API v1.0 online meetings integration using
 * Microsoft Identity Platform OAuth2 client-credentials grant with application permissions.
 *
 * Requirements:
 * - Microsoft Entra Application Permission: OnlineMeetings.ReadWrite.All
 * - Microsoft Teams Application Access Policy assigned to MICROSOFT_ORGANIZER_USER_ID
 *
 * No fake meeting URLs or fabricated fallback links are generated.
 */

// Cache token in memory until expiration
let cachedToken = null;
let tokenExpiresAt = 0;
let inFlightTokenPromise = null;

/**
 * Checks whether all required Microsoft Teams environment variables are configured.
 */
export function isTeamsConfigured() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const organizerId = process.env.MICROSOFT_ORGANIZER_USER_ID;

  return Boolean(
    tenantId &&
      tenantId.trim() &&
      clientId &&
      clientId.trim() &&
      clientSecret &&
      clientSecret.trim() &&
      organizerId &&
      organizerId.trim(),
  );
}

/**
 * Returns configuration status without exposing sensitive values.
 */
export function getTeamsConfigurationStatus() {
  return {
    isConfigured: isTeamsConfigured(),
    hasTenantId: Boolean(process.env.MICROSOFT_TENANT_ID?.trim()),
    hasClientId: Boolean(process.env.MICROSOFT_CLIENT_ID?.trim()),
    hasClientSecret: Boolean(process.env.MICROSOFT_CLIENT_SECRET?.trim()),
    hasOrganizerUserId: Boolean(process.env.MICROSOFT_ORGANIZER_USER_ID?.trim()),
  };
}

/**
 * Obtain or reuse a valid Microsoft Graph access token.
 * Reuses active token until 5 minutes before expiry.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<string>} Access token
 */
export async function getGraphAccessToken({ forceRefresh = false } = {}) {
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();

  if (!tenantId || !clientId || !clientSecret) {
    const missing = [];
    if (!tenantId) missing.push("MICROSOFT_TENANT_ID");
    if (!clientId) missing.push("MICROSOFT_CLIENT_ID");
    if (!clientSecret) missing.push("MICROSOFT_CLIENT_SECRET");
    const err = new Error(
      `Microsoft Teams integration is not configured. Missing environment variables: ${missing.join(", ")}.`,
    );
    err.code = "TEAMS_CONFIG_MISSING";
    err.status = 503;
    throw err;
  }

  const now = Date.now();
  // Reuse token if still valid for at least 5 minutes
  if (!forceRefresh && cachedToken && tokenExpiresAt > now + 300000) {
    return cachedToken;
  }

  // De-duplicate concurrent token requests
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
      const bodyParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      });

      const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        let errorDetails = "Authentication failed";
        try {
          const errData = await res.json();
          errorDetails = errData.error_description || errData.error || res.statusText;
        } catch {
          errorDetails = await res.text();
        }

        console.error(
          `[Microsoft Teams] Token request rejected (HTTP ${res.status}):`,
          errorDetails.slice(0, 300),
        );

        const err = new Error(`Microsoft Identity Platform authentication failed: ${errorDetails}`);
        err.code = "TEAMS_AUTH_FAILED";
        err.status = res.status === 400 || res.status === 401 ? 401 : 502;
        throw err;
      }

      const data = await res.json();
      if (!data.access_token) {
        const err = new Error("Token endpoint returned 200 OK but no access_token was provided.");
        err.code = "TEAMS_TOKEN_EMPTY";
        err.status = 502;
        throw err;
      }

      cachedToken = data.access_token;
      // Expires in seconds; default to 3599 if omitted
      const expiresInSec = Number(data.expires_in) || 3599;
      tokenExpiresAt = Date.now() + expiresInSec * 1000;

      return cachedToken;
    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

/**
 * Creates a real online meeting in Microsoft Teams using Microsoft Graph API v1.0.
 *
 * @param {Object} options
 * @param {string} options.subject - Meeting title
 * @param {string|Date} options.startTime - Valid ISO 8601 string or Date
 * @param {string|Date} options.endTime - Valid ISO 8601 string or Date
 * @param {string} [options.facultyEmail] - Host faculty email
 * @param {string|string[]} [options.attendeeEmails] - Student email(s)
 * @param {string} [options.description] - Agenda or description
 * @param {string} [options.organizerUserId] - Optional override for organizer Entra user object ID
 * @returns {Promise<Object>} Meeting creation result
 */
export async function createTeamsOnlineMeeting({
  subject,
  startTime,
  endTime,
  facultyEmail,
  attendeeEmails = [],
  description,
  organizerUserId,
}) {
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    const err = new Error("Meeting subject/title is required.");
    err.code = "INVALID_SUBJECT";
    err.status = 400;
    throw err;
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const now = new Date();

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    const err = new Error("Invalid start or end time format. ISO 8601 timestamps are required.");
    err.code = "INVALID_TIME_FORMAT";
    err.status = 400;
    throw err;
  }

  if (startDate <= now) {
    const err = new Error("Cannot schedule a meeting in the past.");
    err.code = "START_TIME_PAST";
    err.status = 400;
    throw err;
  }

  if (endDate <= startDate) {
    const err = new Error("Meeting end time must be strictly after start time.");
    err.code = "END_TIME_BEFORE_START";
    err.status = 400;
    throw err;
  }

  // Resolve organizer user identity
  const effectiveOrganizerId =
    organizerUserId ||
    process.env.MICROSOFT_ORGANIZER_USER_ID?.trim() ||
    facultyEmail?.trim();

  if (!effectiveOrganizerId) {
    const err = new Error(
      "No Microsoft Teams organizer configured. Please set MICROSOFT_ORGANIZER_USER_ID in environment variables.",
    );
    err.code = "TEAMS_ORGANIZER_MISSING";
    err.status = 503;
    throw err;
  }

  // Acquire Graph API access token
  const token = await getGraphAccessToken();

  // Normalize attendees
  const rawAttendees = Array.isArray(attendeeEmails)
    ? attendeeEmails
    : attendeeEmails
      ? [attendeeEmails]
      : [];
  const attendeesList = rawAttendees
    .map((e) => (typeof e === "string" ? e.trim() : ""))
    .filter((e) => e && e.includes("@"))
    .map((upn) => ({
      upn,
      role: "attendee",
    }));

  const payload = {
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    subject: subject.trim(),
    isEntryExitAnnounced: true,
    allowedPresenters: "roleIsPresenter",
    lobbyBypassSettings: {
      scope: "organization",
      isDialInBypassEnabled: false,
    },
  };

  if (attendeesList.length > 0) {
    payload.participants = {
      attendees: attendeesList,
    };
  }

  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(effectiveOrganizerId)}/onlineMeetings`;

  let response;
  try {
    response = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
  } catch (netErr) {
    console.error("[Microsoft Teams] Network error connecting to Graph API:", netErr.message);
    const err = new Error(
      `Unable to reach Microsoft Graph API: ${netErr.name === "TimeoutError" ? "Request timed out after 15s" : netErr.message}`,
    );
    err.code = "TEAMS_NETWORK_ERROR";
    err.status = 504;
    throw err;
  }

  if (!response.ok) {
    let errCode = "TEAMS_GRAPH_ERROR";
    let message = "Microsoft Graph online meeting creation failed.";

    try {
      const errJson = await response.json();
      const graphError = errJson.error || {};
      errCode = graphError.code || errCode;
      message = graphError.message || message;
    } catch {
      const rawText = await response.text();
      message = rawText || message;
    }

    console.error(`[Microsoft Teams] Graph API Error (HTTP ${response.status}):`, message);

    let clientMessage = message;
    let httpStatus = 502;

    if (response.status === 401) {
      httpStatus = 502;
      clientMessage = "Microsoft Graph authentication rejected. Verify Microsoft credentials in server configuration.";
    } else if (response.status === 403) {
      httpStatus = 403;
      clientMessage =
        "Microsoft Graph permission denied. Ensure OnlineMeetings.ReadWrite.All application permission is granted and an Application Access Policy is assigned to the organizer.";
    } else if (response.status === 404) {
      httpStatus = 404;
      clientMessage = `Organizer user '${effectiveOrganizerId}' was not found in Microsoft Entra directory. Verify MICROSOFT_ORGANIZER_USER_ID.`;
    } else if (response.status === 429) {
      httpStatus = 429;
      clientMessage = "Microsoft Graph rate limit reached. Please retry after a brief pause.";
    }

    const err = new Error(clientMessage);
    err.code = errCode;
    err.status = httpStatus;
    err.graphStatus = response.status;
    throw err;
  }

  const data = await response.json();

  if (!data.joinWebUrl) {
    const err = new Error("Microsoft Graph returned online meeting object without a valid joinWebUrl.");
    err.code = "TEAMS_JOIN_URL_MISSING";
    err.status = 502;
    throw err;
  }

  return {
    success: true,
    provider: "microsoft_teams",
    isLive: true,
    meetingId: data.id,
    joinWebUrl: data.joinWebUrl,
    organizerUserId: effectiveOrganizerId,
    startDateTime: data.startDateTime || startDate.toISOString(),
    endDateTime: data.endDateTime || endDate.toISOString(),
    subject: data.subject || subject,
    audioConferencing: data.audioConferencing || null,
    videoTeleconferenceId: data.videoTeleconferenceId || null,
  };
}

/**
 * Deletes / cancels an online meeting in Microsoft Teams via Graph API v1.0.
 * Useful for compensating transactions or meeting cancellation.
 *
 * @param {Object} options
 * @param {string} options.meetingId - The Graph online meeting ID
 * @param {string} [options.organizerUserId] - The organizer user ID
 * @returns {Promise<boolean>} True if deleted or already gone
 */
export async function deleteTeamsOnlineMeeting({ meetingId, organizerUserId }) {
  if (!meetingId) return false;

  const effectiveOrganizerId =
    organizerUserId ||
    process.env.MICROSOFT_ORGANIZER_USER_ID?.trim();

  if (!effectiveOrganizerId) {
    console.warn("[Microsoft Teams] Cannot delete meeting: No organizer ID resolved.");
    return false;
  }

  try {
    const token = await getGraphAccessToken();
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(effectiveOrganizerId)}/onlineMeetings/${encodeURIComponent(meetingId)}`;

    const res = await fetch(graphUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok || res.status === 404) {
      return true;
    }

    console.warn(`[Microsoft Teams] Delete meeting returned HTTP ${res.status}`);
    return false;
  } catch (err) {
    console.error("[Microsoft Teams] Error deleting meeting from Graph:", err.message);
    return false;
  }
}

/**
 * Clear cached token (useful in tests or token rotation).
 */
export function resetTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
  inFlightTokenPromise = null;
}
