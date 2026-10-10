# Production Deployment: Vercel + Render

This project is prepared for a split deployment: the Vite/TanStack frontend runs on Vercel, while the Express API and Python RAG service run on Render. Both platforms should be connected to the same GitHub repository and the `main` branch. After this one-time setup, every push to `main` triggers a new frontend deployment and backend/RAG redeploy automatically.

## Deployment options

| Approach                                  | Tradeoffs                                                                                                                                      | Cost                                                                                                                              | Setup complexity                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Vercel + Render using GitHub auto-deploys | Best fit for this repository; separate frontend/API scaling and independent logs; requires two platform projects and environment configuration | Uses the providers’ free tiers where available; RAG cold starts and persistent vector storage may need a paid plan as usage grows | Moderate one-time setup                          |
| Single full-stack host                    | One deployment target and fewer dashboards; frontend, API, and RAG share resources and failures are coupled                                    | Simpler billing but less independent scaling; resource limits can affect RAG performance                                          | Lower initial setup, higher operational coupling |

## Render setup

The repository includes `render.yaml` with two web services:

- `adeptive-learning-api`: Node/Express API, `npm ci`, `npm run server`, health check `/api/health`.
- `adeptive-learning-rag`: Python/FastAPI Agentic RAG service under `rag_service`, health check `/health`, with BGE-M3 embeddings, hybrid retrieval, and Chroma Cloud / persistent storage.

In Render, choose **New → Blueprint**, select this GitHub repository, and deploy the blueprint. Set these secret values in the API service without committing them:

| Variable                | Value                                                  |
| ----------------------- | ------------------------------------------------------ |
| `MONGO_URI`             | MongoDB Atlas connection string                        |
| `JWT_SECRET`            | Long random production secret                          |
| `GEMINI_API_KEY`        | Gemini API key, if enabled                             |
| `GROQ_API_KEY`          | Groq fallback key, if enabled                          |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name                                  |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                                     |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                                  |
| `FRONTEND_URL`          | Final Vercel URL                                       |
| `CORS_ORIGINS`          | Final Vercel URL; add preview origins only if required |

After the RAG service is created, confirm `RAG_SERVICE_URL` resolves to its public Render URL. The Blueprint can supply the service host automatically; the backend normalizes host-only values to HTTPS.

## Vercel setup

Create a Vercel project by importing the same GitHub repository. The repository includes `vercel.json` with:

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback to `/index.html`

Set this Vercel environment variable for **Production**, and set it for **Preview** if preview deployments should call a non-production API:

| Variable        | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `VITE_API_BASE` | The public Render API URL, for example `https://adeptive-learning-api.onrender.com` |

This variable is injected at build time. Changing it requires a new Vercel deployment, which GitHub pushes provide automatically.

## Automatic synchronization workflow

The normal feature workflow is:

```text
Edit locally → run checks → git commit → git push origin main
                                           ├─ Vercel builds and publishes frontend
                                           └─ Render redeploys API and RAG services
```

The frontend calls the Render API through `VITE_API_BASE`; the API calls the Render RAG service through `RAG_SERVICE_URL`. CORS is restricted by `CORS_ORIGINS`, so the deployed Vercel origin must be configured in Render before login or API requests will work.

## Verification checklist

After the first deployment, verify:

1. `https://<render-api>/api/health` returns JSON with `status: "ok"`.
2. `https://<render-rag>/health` returns a healthy response.
3. The Vercel site loads without localhost requests in the browser network panel.
4. Existing admin login works and returns the department claim.
5. CSE HOD user records do not expose IT HOD accounts.
6. Add User creates an account in the correct department.
7. Ask Tutor can reach the API and RAG services.
8. A small commit to `main` creates a new deployment on both platforms.
