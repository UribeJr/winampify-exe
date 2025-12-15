# winampify.exe

A retro Windows 98-style Spotify web player built using the Spotify Web Playback SDK. This project combines nostalgic UI design with modern Spotify integration, featuring a React frontend and Node.js backend for OAuth authentication.

## Features

- OAuth 2.0 authentication with Spotify
- Play/pause controls
- Next/previous track navigation
- Display of currently playing track with album art
- Real-time playback state updates

## Prerequisites

- **Spotify Premium account** (required for Web Playback SDK)
- **Node.js** (v18 or higher recommended)
- **Spotify Developer App** credentials:
  - Client ID
  - Client Secret
  - Redirect URI configured in Spotify Dashboard

## Setup

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an app"
3. Fill in the app details
4. Note your **Client ID** and **Client Secret**
5. Add `http://localhost:3000/callback` to your app's **Redirect URIs**

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
PORT=3001

VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

Replace `your_client_id_here` and `your_client_secret_here` with your actual Spotify app credentials.

### 4. Run the Application

#### Option 1: Run both server and client together
```bash
npm run dev
```

#### Option 2: Run separately

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run client
```

The backend will run on `http://localhost:3001` and the frontend on `http://localhost:3000`.

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Click "Login to Spotify"
3. Authorize the application
4. Once connected, you can control playback using the player controls
5. The currently playing track will be displayed with album art

## Project Structure

```
.
├── server.js           # Express backend with OAuth endpoints
├── vite.config.js      # Vite configuration
├── index.html          # HTML template (Vite entry point)
├── src/
│   ├── App.jsx         # Main React component with Web Playback SDK
│   ├── index.jsx       # React entry point
│   └── index.css       # Styles
├── public/             # Static assets (if needed)
├── package.json        # Dependencies and scripts
└── .env               # Environment variables (create this)
```

## API Endpoints

- `GET /login` - Initiates Spotify OAuth flow
- `GET /callback` - Handles OAuth callback from Spotify
- `POST /refresh_token` - Refreshes access token

## Deployment to Render

This app is configured to deploy as a **Web Service** on Render.

### Render Setup Steps:

1. **Create a new Web Service** on Render
2. **Connect your repository** (GitHub/GitLab)
3. **Configure Build & Start Commands:**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. **Set Environment Variables** in Render Dashboard:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=https://your-app.onrender.com/callback
   FRONTEND_URL=https://your-app.onrender.com
   CLIENT_ORIGIN=https://your-app.onrender.com
   NODE_ENV=production
   ```
5. **Update Spotify App Settings:**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Add your Render URL to **Redirect URIs**: `https://your-app.onrender.com/callback`
6. **Deploy!**

### Environment Variables for Production:

Create a `.env` file or set these in Render's environment variables:

```env
# Required
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=https://your-app.onrender.com/callback
FRONTEND_URL=https://your-app.onrender.com
CLIENT_ORIGIN=https://your-app.onrender.com
NODE_ENV=production

# Optional (Render sets PORT automatically)
PORT=3001
```

### Frontend Environment Variables (for Vite):

If deploying separately, create a `.env` file with:

```env
VITE_API_BASE_URL=https://your-app.onrender.com
VITE_SPOTIFY_CLIENT_ID=your_client_id
VITE_SPOTIFY_REDIRECT_URI=https://your-app.onrender.com/callback
```

## Notes

- This application requires **Spotify Premium** to use the Web Playback SDK
- The app uses `localhost` for development. For production, update the redirect URIs and use HTTPS
- Access tokens expire after 1 hour. The refresh token endpoint can be used to get new tokens
- In production, the Express server serves both the API and the static React build files

## Troubleshooting

- **"Device not found"**: Make sure you have Spotify Premium and that no other device is actively playing
- **"Invalid client"**: Verify your Client ID and Client Secret in the `.env` file
- **CORS errors**: Ensure the backend is running on port 3001 and frontend on port 3000

## Resources

- [Spotify Web Playback SDK Documentation](https://developer.spotify.com/documentation/web-playback-sdk)
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)


