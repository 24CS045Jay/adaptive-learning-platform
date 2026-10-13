# Microsoft Teams Online Meetings Integration Setup Guide
**EduSense AI — Faculty Connect Feature**

This guide documents how to configure **real Microsoft Teams online meeting integration** with Microsoft Graph API `v1.0` using application permissions and client credentials.

---

## Architecture Overview

```
Faculty Connect (UI)
       │
       ▼
Express API (/api/meetings)
       │
       ├─► Microsoft Identity Platform (OAuth2 token endpoint)
       │       POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
       │
       ├─► Microsoft Graph API v1.0
       │       POST https://graph.microsoft.com/v1.0/users/{organizerUserId}/onlineMeetings
       │
       └─► Supabase Database
               `meeting_slots` & `meeting_bookings` tables
```

### Standalone Online Meetings vs. Outlook Calendar Events
EduSense AI uses the Microsoft Graph **Online Meetings API** (`/users/{organizerUserId}/onlineMeetings`).
- **Behavior**: Generates an authentic Microsoft Teams meeting bridge with `joinWebUrl`, conference coordinates, and lobby settings.
- **Calendar Distinction**: Standalone online meetings do **not** automatically clutter the organizer's personal Outlook calendar with tentative slots. Meeting invitations are delivered in-app to approved students, who click the verified Teams join URL when the session starts.

---

## Step 1: Register an Application in Microsoft Entra ID

1. Sign in to the [Microsoft Entra admin center](https://entra.microsoft.com) (formerly Azure Active Directory).
2. Navigate to **Identity** > **Applications** > **App registrations**.
3. Select **New registration**:
   - **Name**: `EduSense AI Teams Integration`
   - **Supported account types**: `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI**: Leave blank (not required for client-credentials flow)
4. Click **Register**.
5. Note the following values from the **Overview** page:
   - **Application (client) ID** (`MICROSOFT_CLIENT_ID`)
   - **Directory (tenant) ID** (`MICROSOFT_TENANT_ID`)

---

## Step 2: Create a Client Secret

1. Under the app registration, select **Certificates & secrets** > **Client secrets**.
2. Click **New client secret**:
   - **Description**: `EduSense Production Secret`
   - **Expires**: Select an appropriate lifetime according to your institution's rotation policy (e.g., 180 days or 365 days).
3. Click **Add**.
4. **Copy the secret `Value` immediately**. Microsoft will mask it once you navigate away. This value is your `MICROSOFT_CLIENT_SECRET`.

> [!CAUTION]
> Never commit client secrets to Git or share them in unencrypted channels. Treat this secret like a database password.

---

## Step 3: Configure Microsoft Graph Application Permissions

1. In the app registration, select **API permissions**.
2. Click **Add a permission** > **Microsoft Graph**.
3. Select **Application permissions** (not Delegated permissions).
4. Search for and select:
   - `OnlineMeetings.ReadWrite.All`
5. Click **Add permissions**.
6. Click **Grant admin consent for <Your Organization>** and confirm with **Yes**.
7. Verify that the permission displays a green checkmark under **Status**.

---

## Step 4: Configure Microsoft Teams Application Access Policy

> [!IMPORTANT]
> The `OnlineMeetings.ReadWrite.All` application permission alone is **not sufficient** to create online meetings on behalf of a user. Microsoft Teams strictly requires an **Application Access Policy** that grants the application permission to act on behalf of specific organizer user(s). Without this step, Microsoft Graph returns `403 Forbidden` (`GeneralException: Access is denied`).

### Prerequisites
- Install PowerShell 7+ or Windows PowerShell 5.1.
- Install the Microsoft Teams PowerShell module:
  ```powershell
  Install-Module -Name MicrosoftTeams -Force -AllowClobber
  ```

### Run PowerShell Commands
Open PowerShell as administrator and execute:

```powershell
# 1. Connect to Microsoft Teams as a Tenant Administrator
Connect-MicrosoftTeams

# 2. Create an Application Access Policy for EduSense AI
# Replace <YOUR_APP_CLIENT_ID> with your MICROSOFT_CLIENT_ID from Step 1
New-CsApplicationAccessPolicy `
    -Identity "EduSenseTeamsMeetingPolicy" `
    -AppIds "<YOUR_APP_CLIENT_ID>" `
    -Description "Allows EduSense AI to schedule Teams meetings for faculty organizers"

# 3. Grant the policy to your designated organizer user
# Replace <ORGANIZER_UPN> with the faculty organizer's email (e.g. faculty.lead@charusat.edu.in)
Grant-CsApplicationAccessPolicy `
    -PolicyName "EduSenseTeamsMeetingPolicy" `
    -Identity "<ORGANIZER_UPN>"

# 4. Verify policy assignment
Get-CsUserPolicyAssignment -Identity "<ORGANIZER_UPN>"
```

> [!NOTE]
> It can take up to 30 minutes for newly created Application Access Policies to replicate across Microsoft 365 services globally.

---

## Step 5: Find the Organizer User Object ID

Microsoft Graph online meeting creation uses the Entra user object ID:
`POST /v1.0/users/{organizerUserId}/onlineMeetings`

To find the user Object ID:
1. In the [Microsoft Entra admin center](https://entra.microsoft.com), navigate to **Identity** > **Users** > **All users**.
2. Search for the designated organizer faculty user account.
3. Click the user name and locate the **Object ID** (a GUID formatted like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
4. This value is your `MICROSOFT_ORGANIZER_USER_ID`.

---

## Step 6: Configure Environment Variables

Edit your `.env` file on the server (do not commit to version control):

```env
# Microsoft Teams Integration (Faculty Connect)
MICROSOFT_TENANT_ID=00000000-0000-0000-0000-000000000000
MICROSOFT_CLIENT_ID=11111111-1111-1111-1111-111111111111
MICROSOFT_CLIENT_SECRET=your_client_secret_value_here
MICROSOFT_ORGANIZER_USER_ID=22222222-2222-2222-2222-222222222222
```

---

## Step 7: Apply Database Migration

Ensure the `meeting_slots` and `meeting_bookings` tables exist in your Supabase database.

Open the **Supabase Dashboard** > **SQL Editor** > **New Query**, paste the contents of:
`migrations/20261012_faculty_connect_meetings.sql`

Click **Run** to create the tables, indexes, and RLS policies safely.

---

## Step 8: Verify Integration

Restart the Express backend:
```bash
npm run server
```

Check the health status endpoint:
```bash
curl http://localhost:5000/api/meetings/status \
  -H "Authorization: Bearer <your_jwt>"
```

Response:
```json
{
  "service": "Microsoft Teams Online Meetings Integration",
  "provider": "microsoft_teams",
  "isConfigured": true,
  "hasTenantId": true,
  "hasClientId": true,
  "hasClientSecret": true,
  "hasOrganizerUserId": true
}
```

---

## Troubleshooting Common Errors

| HTTP Status | Error / Graph Code | Root Cause & Resolution |
|---|---|---|
| `401 Unauthorized` | `AADSTS700016: Application with identifier ... not found` | `MICROSOFT_CLIENT_ID` or `MICROSOFT_TENANT_ID` is misspelled or from the wrong tenant. |
| `401 Unauthorized` | `AADSTS7000215: Invalid client secret is provided` | `MICROSOFT_CLIENT_SECRET` has expired or the Secret ID was copied instead of Secret Value. Generate a new secret. |
| `403 Forbidden` | `GeneralException: Access is denied` / `Forbidden` | **Missing Application Access Policy**. Follow Step 4 to run `Grant-CsApplicationAccessPolicy` in Microsoft Teams PowerShell and allow 30 minutes for replication. |
| `403 Forbidden` | `Authorization_RequestDenied` | The Entra app registration is missing `OnlineMeetings.ReadWrite.All` application permission or administrator consent was not granted (Step 3). |
| `404 Not Found` | `ResourceNotFound` / `User not found` | The `MICROSOFT_ORGANIZER_USER_ID` does not exist in the tenant or has been deleted. Ensure the correct Entra user Object ID is configured. |
| `429 Too Many Requests` | `ActivityLimitReached` | Microsoft Graph API rate limit reached. The EduSense API will return HTTP 429 with backoff advisory. |
| `504 Gateway Timeout` | `TEAMS_NETWORK_ERROR` | Network timeout reaching `graph.microsoft.com`. Check firewall and outbound HTTPS connectivity. |

---

## Credential Rotation & Incident Response

If a client secret is ever compromised:
1. Immediately navigate to **Entra admin center** > **App registrations** > **Certificates & secrets**.
2. Click **New client secret** and configure a replacement.
3. Update `MICROSOFT_CLIENT_SECRET` in `.env` and restart the backend service.
4. Verify meeting creation on a test session.
5. In the Entra admin center, click the trash can icon to **Delete** the old/compromised secret.
