import { CorsOptions } from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [process.env.CLIENT_URL || "http://localhost:3000"];

export const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  credentials: true
};
