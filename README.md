# SUT Court Queue

Basketball court queue management system for SUT (Suranaree University of Technology).

## Features

- Real-time queue management
- Live match scoring
- Admin dashboard
- Mobile-responsive design
- WebSocket-based real-time updates

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, TypeScript, Socket.IO
- **Database**: SQLite (development), PostgreSQL (production)
- **Real-time**: Socket.IO

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies for all packages:
   ```bash
   npm run install:all
   ```

3. Copy environment files:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

4. Start the development servers:
   ```bash
   npm run dev
   ```

This will start:
- Backend server on http://localhost:5000
- Frontend client on http://localhost:3000

### Available Scripts

- `npm run dev` - Start both client and server in development mode
- `npm run dev:client` - Start only the client development server
- `npm run dev:server` - Start only the server development server
- `npm run build` - Build both client and server for production
- `npm run start` - Start the production server
- `npm test` - Run server tests

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   └── types/          # TypeScript types
│   └── public/             # Static assets
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   └── dist/               # Compiled JavaScript
└── docs/                   # Documentation
```

## Environment Variables

### Server (.env)
- `PORT` - Server port (default: 5000)
- `CLIENT_URL` - Frontend URL for CORS
- `JWT_SECRET` - Secret key for JWT tokens
- `DATABASE_URL` - Database connection string

### Client (.env)
- `VITE_API_URL` - Backend API URL
- `VITE_SOCKET_URL` - WebSocket server URL

## Development

The project uses:
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Jest for testing
- Tailwind CSS for styling

## License

MIT License