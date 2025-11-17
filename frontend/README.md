# Viberate Platform Frontend

React + TypeScript + Vite frontend for the Viberate Platform.

## Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Update the API URL in `.env`:
```
VITE_API_URL=http://localhost:8000
```

4. Run the development server:
```bash
npm run dev
```

## Building for Production

```bash
npm run build
```

## Deployment to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variable:
```bash
vercel env add VITE_API_URL
```
Enter your Railway backend URL (e.g., `https://your-app.railway.app`)

## Features

- User authentication (login/register)
- Task management
- Annotation task management with Label Studio integration
- Responsive design
- Dark mode UI
